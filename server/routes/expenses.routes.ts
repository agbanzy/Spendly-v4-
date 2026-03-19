import express from "express";
import path from "path";
import { storage } from "../storage";
import { requireAuth, requireAdmin, requirePin } from "../middleware/auth";
import { notificationService } from "../services/notification-service";
import { mapPaymentError } from "../utils/paymentUtils";
import { getPaymentProvider } from "../paymentService";
import {
  param,
  resolveUserCompany,
  verifyCompanyAccess,
  expenseSchema,
  expenseUpdateSchema,
  upload,
  logAudit,
  getAuditUserName,
  validateAmount,
  getSettingsForRequest,
} from "./shared";

const router = express.Router();

const uploadDir = path.join(process.cwd(), "uploads");

// ==================== EXPENSES ====================

router.get("/expenses", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const expenses = await storage.getExpenses(company?.companyId);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

router.get("/expenses/:id", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const expense = await storage.getExpense(param(req.params.id));
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }
    if (company && !(await verifyCompanyAccess(expense.companyId, company.companyId))) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch expense" });
  }
});

router.use("/uploads", requireAuth, express.static(uploadDir));

router.post("/upload/receipt", requireAuth, upload.single("receipt"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Validate magic bytes to prevent MIME spoofing
    const { validateUploadedFile } = await import("../utils/fileValidation");
    if (!validateUploadedFile(req.file.path, req.file.mimetype)) {
      // Delete the spoofed file
      const fsDel = await import("fs");
      fsDel.unlinkSync(req.file.path);
      return res
        .status(400)
        .json({ error: "Invalid file content. Only JPEG, PNG, and PDF files are allowed." });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: fileUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to upload file" });
  }
});

router.post("/expenses", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const result = expenseSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid expense data", details: result.error.issues });
    }
    const { merchant, amount, category, note, receiptUrl, expenseType, attachments, taggedReviewers, userId, user } =
      result.data;

    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return res.status(400).json({ error: amountCheck.error });
    }

    // Get company settings for auto-approval and currency
    const settings = await getSettingsForRequest(req);
    const currency = settings.currency || "USD";
    const autoApproveThreshold = parseFloat(settings.autoApproveBelow?.toString() || "100");
    const expenseAmount = parseFloat(amount);

    // Determine status based on expense type and auto-approval threshold
    let status = "PENDING";
    let autoApproved = false;

    if (expenseType === "spent") {
      // Already spent - auto approve
      status = "APPROVED";
      autoApproved = true;
    } else if (expenseAmount <= autoApproveThreshold) {
      // Below auto-approve threshold
      status = "APPROVED";
      autoApproved = true;
    }

    const expense = await storage.createExpense({
      merchant,
      amount,
      currency,
      date: new Date().toISOString().split("T")[0],
      category,
      status,
      user: user || "Unknown User",
      userId: userId || "1",
      department: "General",
      note: note || null,
      receiptUrl: receiptUrl || null,
      expenseType: expenseType || "request",
      attachments: attachments || [],
      taggedReviewers: taggedReviewers || [],
      companyId: company?.companyId ?? null,
      vendorId: null,
      payoutStatus: null,
      payoutId: null,
      reviewerComments: null,
    });

    // Notify the submitter
    const submitterUid = (req as any).user?.uid || userId || "1";
    if (status === "PENDING") {
      notificationService
        .notifyExpenseSubmitted(submitterUid, {
          id: expense.id,
          merchant,
          amount: expenseAmount,
          currency,
        })
        .catch(console.error);
    }

    // Notify tagged reviewers for review
    if (taggedReviewers && taggedReviewers.length > 0) {
      const submitterProfile = await storage.getUserProfileByCognitoSub(submitterUid);
      const submitterName = submitterProfile?.displayName || user || "A team member";
      for (const reviewerId of taggedReviewers) {
        notificationService
          .notifyExpenseReviewRequested(reviewerId, {
            id: expense.id,
            merchant,
            amount: expenseAmount,
            currency,
            submitterName,
            note: note || undefined,
          })
          .catch(console.error);
      }
    }

    // If pending, also notify managers/admins for approval
    if (status === "PENDING") {
      const teamMembers = await storage.getTeam();
      const approvers = teamMembers.filter((m: any) =>
        ["Owner", "Admin", "Manager"].includes(m.role) && m.userId
      );
      if (approvers.length > 0) {
        const submitterProfile = await storage.getUserProfileByCognitoSub(submitterUid);
        const submitterName = submitterProfile?.displayName || user || "A team member";
        // Send rich approval request emails to approvers
        for (const approver of approvers) {
          if (approver.email) {
            notificationService
              .sendExpenseApprovalRequestEmail({
                email: approver.email,
                approverName: approver.name || "Manager",
                submitterName,
                expenseDescription: merchant,
                amount: expenseAmount,
                currency,
                expenseDate: new Date().toISOString().split("T")[0],
              })
              .catch(console.error);
          }
        }

        notificationService
          .notifyExpenseSubmittedForApproval(
            approvers.map((a: any) => a.userId).filter(Boolean),
            {
              id: expense.id,
              merchant,
              amount: expenseAmount,
              currency,
              submitterName,
              category,
            }
          )
          .catch(console.error);
      }
    }

    res.status(201).json({ ...expense, autoApproved });
  } catch (error) {
    res.status(500).json({ error: "Failed to create expense" });
  }
});

router.patch("/expenses/:id", requireAuth, requirePin, async (req, res) => {
  try {
    const result = expenseUpdateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid expense data", details: result.error.issues });
    }

    // SECURITY: Role check for expense approval/rejection/changes-requested
    if (
      result.data.status === "APPROVED" ||
      result.data.status === "REJECTED" ||
      result.data.status === "CHANGES_REQUESTED"
    ) {
      const userCompany = await resolveUserCompany(req);
      if (!userCompany || !["OWNER", "ADMIN", "MANAGER"].includes(userCompany.role)) {
        return res.status(403).json({
          error: "Only owners, admins, and managers can approve, reject, or request changes on expenses",
        });
      }
    }

    // Set approval/rejection metadata
    if (result.data.status === "APPROVED") {
      (result.data as any).approvedBy = (req as any).user?.uid || "unknown";
      (result.data as any).approvedAt = new Date().toISOString();
    }
    if (result.data.status === "REJECTED") {
      (result.data as any).rejectedBy = (req as any).user?.uid || "unknown";
      (result.data as any).rejectedAt = new Date().toISOString();
    }

    const originalExpense = await storage.getExpense(param(req.params.id));
    const expense = await storage.updateExpense(param(req.params.id), result.data);
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    // Send notification if status changed
    if (originalExpense && expense.status !== originalExpense.status) {
      const userId = (expense as any).submittedBy || expense.userId || "system";

      if (expense.status === "APPROVED") {
        notificationService
          .notifyExpenseApproved(userId, {
            id: expense.id,
            merchant: expense.merchant,
            amount: parseFloat(expense.amount),
          })
          .catch(console.error);

        // Send rich approval email
        const approverProfile = await storage.getUserProfileByCognitoSub((req as any).user?.uid);
        const submitterProfile = await storage.getUserProfileByCognitoSub(userId);
        if (submitterProfile?.email) {
          notificationService
            .sendExpenseApprovedEmail({
              email: submitterProfile.email,
              name: submitterProfile.displayName || "Team Member",
              expenseDescription: expense.merchant,
              amount: parseFloat(expense.amount),
              currency: expense.currency || "USD",
              approverName: approverProfile?.displayName || "Admin",
            })
            .catch(console.error);
        }

        if (expense.payoutStatus === "not_started" || !expense.payoutStatus) {
          try {
            const destinations = await storage.getPayoutDestinations(expense.userId);
            const defaultDest = destinations?.find((d: any) => d.isDefault) || destinations?.[0];

            if (defaultDest) {
              const settings = await storage.getOrganizationSettings();
              const currency = settings?.currency || expense.currency || "USD";
              const provider = getPaymentProvider((defaultDest as any).country || "US");
              const approverUserId = (req as any).user?.uid || "system";

              const payout = await storage.createPayout({
                type: "expense_reimbursement",
                amount: expense.amount,
                currency,
                status: "pending",
                recipientType: "employee",
                recipientId: expense.userId,
                recipientName: expense.user,
                destinationId: defaultDest.id,
                provider,
                relatedEntityType: "expense",
                relatedEntityId: expense.id,
                initiatedBy: approverUserId,
                approvalStatus: "pending",
              } as any);

              await storage.updateExpense(expense.id, {
                payoutStatus: "pending_approval",
                payoutId: payout.id,
              });

              console.log(`[Auto-Disburse] Created payout ${payout.id} for approved expense ${expense.id}`);
            }
          } catch (disbErr: any) {
            console.error(`[Auto-Disburse] Failed for expense ${expense.id}:`, disbErr.message);
          }
        }
      } else if (expense.status === "REJECTED") {
        notificationService
          .notifyExpenseRejected(userId, {
            id: expense.id,
            merchant: expense.merchant,
            amount: parseFloat(expense.amount),
            reason: result.data.rejectionReason,
          })
          .catch(console.error);

        // Send rich rejection email
        const rejectorProfile = await storage.getUserProfileByCognitoSub((req as any).user?.uid);
        const rejectedUserProfile = await storage.getUserProfileByCognitoSub(userId);
        if (rejectedUserProfile?.email) {
          notificationService
            .sendExpenseRejectedEmail({
              email: rejectedUserProfile.email,
              name: rejectedUserProfile.displayName || "Team Member",
              expenseDescription: expense.merchant,
              amount: parseFloat(expense.amount),
              currency: expense.currency || "USD",
              rejectedBy: rejectorProfile?.displayName || "Admin",
              reason: result.data.rejectionReason,
            })
            .catch(console.error);
        }
      }
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: "Failed to update expense" });
  }
});

router.delete("/expenses/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await storage.deleteExpense(param(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "Expense not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

// Batch expense approval
router.post("/expenses/batch-approve", requireAuth, requireAdmin, requirePin, async (req, res) => {
  try {
    const { expenseIds } = req.body;
    if (!Array.isArray(expenseIds) || expenseIds.length === 0) {
      return res.status(400).json({ error: "expenseIds must be a non-empty array" });
    }
    if (expenseIds.length > 50) {
      return res.status(400).json({ error: "Cannot batch approve more than 50 expenses at once" });
    }

    const approverId = (req as any).user?.uid;
    const approverProfile = await storage.getUserProfileByCognitoSub(approverId);
    const approverName = approverProfile?.displayName || "Admin";
    const results: { id: string; status: string; error?: string }[] = [];

    for (const id of expenseIds) {
      try {
        const expense = await storage.getExpense(id);
        if (!expense) {
          results.push({ id, status: "skipped", error: "Not found" });
          continue;
        }
        if (expense.status !== "PENDING") {
          results.push({ id, status: "skipped", error: `Already ${expense.status}` });
          continue;
        }

        await storage.updateExpense(id, { status: "APPROVED" });

        // Send notifications
        const submitterId = (expense as any).submittedBy || expense.userId || "system";
        notificationService
          .notifyExpenseApproved(submitterId, {
            id: expense.id,
            merchant: expense.merchant,
            amount: parseFloat(expense.amount),
          })
          .catch(console.error);

        const submitterProfile = await storage.getUserProfileByCognitoSub(submitterId);
        if (submitterProfile?.email) {
          notificationService
            .sendExpenseApprovedEmail({
              email: submitterProfile.email,
              name: submitterProfile.displayName || "Team Member",
              expenseDescription: expense.merchant,
              amount: parseFloat(expense.amount),
              currency: expense.currency || "USD",
              approverName,
            })
            .catch(console.error);
        }

        results.push({ id, status: "approved" });
      } catch (err: any) {
        results.push({ id, status: "failed", error: err.message });
      }
    }

    const approved = results.filter((r) => r.status === "approved").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const failed = results.filter((r) => r.status === "failed").length;

    res.json({ total: expenseIds.length, approved, skipped, failed, results });
  } catch (error) {
    res.status(500).json({ error: "Failed to batch approve expenses" });
  }
});

// ==================== EXPENSE APPROVAL & PAYOUT FLOW ====================

// Reject expense with audit trail
router.post("/expenses/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const userId = (req as any).user?.uid;
    const userName = await getAuditUserName(req);

    const expense = await storage.getExpense(param(req.params.id));
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    if (expense.status !== "PENDING") {
      return res.status(400).json({ error: "Only pending expenses can be rejected" });
    }

    const updatedExpense = await storage.updateExpense(expense.id, {
      status: "REJECTED",
    });

    // Log rejection to audit trail
    await logAudit(
      "expense",
      expense.id,
      "rejected",
      userId,
      userName,
      { status: "PENDING" },
      { status: "REJECTED" },
      { reason: reason || "No reason provided", rejectedBy: userId }
    );

    // Notify the submitter about rejection
    await notificationService
      .notifyExpenseRejected(expense.userId, {
        id: expense.id,
        merchant: expense.merchant,
        amount: parseFloat(expense.amount),
      })
      .catch((err) => console.error("Failed to notify rejection:", err));

    res.json(updatedExpense);
  } catch (error: any) {
    const mapped = mapPaymentError(error, "payment");
    res.status(mapped.statusCode).json({ error: mapped.userMessage });
  }
});

// Request changes on an expense (reviewer sends back for revision)
router.post("/expenses/:id/request-changes", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { comments } = req.body;
    if (!comments || typeof comments !== "string" || comments.trim().length === 0) {
      return res.status(400).json({ error: "Comments are required when requesting changes" });
    }

    const userId = (req as any).user?.uid;
    const userName = await getAuditUserName(req);

    const expense = await storage.getExpense(param(req.params.id));
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    if (expense.status !== "PENDING") {
      return res.status(400).json({ error: "Only pending expenses can have changes requested" });
    }

    const updatedExpense = await storage.updateExpense(expense.id, {
      status: "CHANGES_REQUESTED",
      reviewerComments: comments.trim(),
    });

    await logAudit(
      "expense",
      expense.id,
      "changes_requested",
      userId,
      userName,
      { status: "PENDING" },
      { status: "CHANGES_REQUESTED", reviewerComments: comments.trim() },
      { requestedBy: userId }
    );

    // Notify the submitter
    await notificationService
      .notifyExpenseRejected(expense.userId, {
        id: expense.id,
        merchant: expense.merchant,
        amount: parseFloat(expense.amount),
      })
      .catch((err) => console.error("Failed to notify changes requested:", err));

    res.json(updatedExpense);
  } catch (error: any) {
    const mapped = mapPaymentError(error, "payment");
    res.status(mapped.statusCode).json({ error: mapped.userMessage });
  }
});

// Approve expense and initiate payout
router.post("/expenses/:id/approve-and-pay", requireAuth, requireAdmin, requirePin, async (req, res) => {
  try {
    const { approvedBy, vendorId } = req.body;

    const expense = await storage.getExpense(param(req.params.id));
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    if (expense.status !== "PENDING") {
      return res.status(400).json({ error: "Expense is not pending" });
    }

    // Update expense status
    const updatedExpense = await storage.updateExpense(expense.id, {
      status: "APPROVED",
      vendorId: vendorId || expense.vendorId,
      payoutStatus: "pending",
    });

    // Determine recipient (employee or vendor)
    const recipientType = vendorId ? "vendor" : "employee";
    const recipientId = vendorId || expense.userId;
    let recipientName = expense.user;

    if (vendorId) {
      const vendor = await storage.getVendor(vendorId);
      if (vendor) {
        recipientName = vendor.name;
      }
    }

    // Get recipient's payout destination
    const destinations = await storage.getPayoutDestinations(
      recipientType === "employee" ? recipientId : undefined,
      recipientType === "vendor" ? recipientId : undefined
    );
    const defaultDestination = destinations.find((d) => d.isDefault) || destinations[0];

    // Create payout
    const payout = await storage.createPayout({
      type: "expense_reimbursement",
      amount: expense.amount,
      currency: expense.currency,
      status: "pending",
      recipientType,
      recipientId,
      recipientName,
      destinationId: defaultDestination?.id,
      provider: defaultDestination?.provider || "stripe",
      relatedEntityType: "expense",
      relatedEntityId: expense.id,
      initiatedBy: approvedBy,
    });

    // Update expense with payout ID
    await storage.updateExpense(expense.id, {
      payoutId: payout.id,
    });

    // Log audit trail for expense approval
    const userId = (req as any).user?.uid;
    const userName = await getAuditUserName(req);
    await logAudit(
      "expense",
      expense.id,
      "approved",
      userId,
      userName,
      { status: "PENDING", payoutStatus: "not_started" },
      { status: "APPROVED", payoutStatus: "pending", payoutId: payout.id },
      { approvedBy, vendorId, amount: expense.amount, currency: expense.currency }
    );

    // Send notification
    await notificationService.notifyExpenseApproved(expense.userId, {
      id: expense.id,
      merchant: expense.merchant,
      amount: parseFloat(expense.amount),
    });

    res.json({ expense: updatedExpense, payout });
  } catch (error: any) {
    const mapped = mapPaymentError(error, "payment");
    res.status(mapped.statusCode).json({ error: mapped.userMessage, correlationId: mapped.correlationId });
  }
});

export default router;
