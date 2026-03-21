import express from "express";
import { z } from "zod";
import { param, resolveUserCompany, verifyCompanyAccess, departmentSchema, departmentUpdateSchema, logAudit, getAuditUserName, getSettingsForRequest, header } from "./shared";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { storage } from "../storage";
import { notificationService } from "../services/notification-service";

function getPermissionsForRole(role: string): string[] {
  const upper = (role || 'EMPLOYEE').toUpperCase();
  if (upper === 'OWNER' || upper === 'ADMIN') {
    return ['CREATE_EXPENSE', 'APPROVE_EXPENSE', 'VIEW_REPORTS', 'MANAGE_TEAM', 'MANAGE_SETTINGS'];
  }
  if (upper === 'MANAGER') {
    return ['CREATE_EXPENSE', 'APPROVE_EXPENSE', 'VIEW_REPORTS'];
  }
  return ['CREATE_EXPENSE'];
}

const router = express.Router();

// ==================== DEPARTMENTS ====================
router.get("/departments", requireAuth, async (req, res) => {
  try {
    const depts = await storage.getDepartments();
    res.json(depts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

router.get("/departments/:id", requireAuth, async (req, res) => {
  try {
    const dept = await storage.getDepartment(param(req.params.id));
    if (!dept) {
      return res.status(404).json({ error: "Department not found" });
    }
    res.json(dept);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch department" });
  }
});

router.post("/departments", requireAuth, async (req, res) => {
  try {
    const result = departmentSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid department data", details: result.error.issues });
    }
    const { name, description, headId, budget, color } = result.data;
    const dept = await storage.createDepartment({
      name,
      description: description || null,
      headId: headId || null,
      budget: budget ? String(budget) : null,
      color: color || '#6366f1',
      memberCount: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      companyId: null,
    });
    res.status(201).json(dept);
  } catch (error) {
    console.error("Create department error:", error);
    res.status(500).json({ error: "Failed to create department" });
  }
});

router.patch("/departments/:id", requireAuth, async (req, res) => {
  try {
    const result = departmentUpdateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid department data", details: result.error.issues });
    }
    const { name, description, headId, budget, color, status, memberCount } = result.data;
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (headId !== undefined) updateData.headId = headId;
    if (budget !== undefined) updateData.budget = budget ? String(budget) : null;
    if (color !== undefined) updateData.color = color;
    if (status !== undefined) updateData.status = status;
    if (memberCount !== undefined) updateData.memberCount = memberCount;

    const dept = await storage.updateDepartment(param(req.params.id), updateData);
    if (!dept) {
      return res.status(404).json({ error: "Department not found" });
    }
    res.json(dept);
  } catch (error) {
    res.status(500).json({ error: "Failed to update department" });
  }
});

router.delete("/departments/:id", requireAuth, async (req, res) => {
  try {
    const success = await storage.deleteDepartment(param(req.params.id));
    if (!success) {
      return res.status(404).json({ error: "Department not found" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete department" });
  }
});

// ==================== COMPANIES ====================

const createCompanySchema = z.object({
  name: z.string().min(1).max(100),
  industry: z.string().optional(),
  size: z.string().optional(),
  website: z.string().optional(),
  country: z.string().optional().default('US'),
  currency: z.string().optional().default('USD'),
});

router.post("/companies", requireAuth, async (req, res) => {
  try {
    const result = createCompanySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid company data", details: result.error.issues });
    }

    const { name, industry, size, website, country, currency } = result.data;
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!slug) {
      slug = `company-${Date.now()}`;
    }

    const existing = await storage.getCompanyBySlug(slug);
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
      const existingAgain = await storage.getCompanyBySlug(slug);
      if (existingAgain) {
        return res.status(400).json({ error: "A company with a similar name already exists. Please choose a different name." });
      }
    }

    const userId = (req as any).user?.uid || (req as any).user?.id;
    const company = await storage.createCompany({
      name,
      slug,
      ownerId: userId,
      industry: industry || null,
      size: size || null,
      website: website || null,
      country: country || 'US',
      currency: currency || 'USD',
      status: 'active',
    });

    await storage.createCompanyMember({
      companyId: company.id,
      userId,
      email: (req as any).user?.email || '',
      role: 'OWNER',
      status: 'active',
      invitedAt: new Date().toISOString(),
      joinedAt: new Date().toISOString(),
    });

    res.status(201).json(company);
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ error: "Failed to create company" });
  }
});

router.get("/companies", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.uid || (req as any).user?.id;
    const memberships = await storage.getUserCompanies(userId);
    const companiesResult: any[] = [];
    for (const membership of memberships) {
      const company = await storage.getCompany(membership.companyId);
      if (company) {
        companiesResult.push({ ...company, role: membership.role, membershipId: membership.id });
      }
    }
    res.json(companiesResult);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch companies" });
  }
});

router.get("/companies/:id", requireAuth, async (req, res) => {
  try {
    const company = await storage.getCompany(param(req.params.id));
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
    res.json(company);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch company" });
  }
});

router.get("/companies/:id/members", requireAuth, async (req, res) => {
  try {
    const members = await storage.getCompanyMembers(param(req.params.id));
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch company members" });
  }
});

// ==================== COMPANY INVITATIONS ====================

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.string().optional().default('EMPLOYEE'),
  department: z.string().optional(),
});

router.post("/companies/:id/invitations", requireAuth, async (req, res) => {
  try {
    const companyId = param(req.params.id);
    const company = await storage.getCompany(companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    const userId = (req as any).user?.uid || (req as any).user?.id;
    const membership = await storage.getCompanyMember(companyId, userId);
    if (!membership || !['OWNER', 'ADMIN', 'MANAGER'].includes(membership.role)) {
      return res.status(403).json({ error: "You do not have permission to invite members" });
    }

    const result = inviteSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid invitation data", details: result.error.issues });
    }

    const { email, name, role, department } = result.data;

    // Enforce role hierarchy: inviter must have equal or higher role
    const ROLE_HIERARCHY: Record<string, number> = {
      OWNER: 6, ADMIN: 5, MANAGER: 4, EDITOR: 3, EMPLOYEE: 2, VIEWER: 1,
    };
    const inviterLevel = ROLE_HIERARCHY[membership.role] || 0;
    const assignedLevel = ROLE_HIERARCHY[role || 'EMPLOYEE'] || 0;
    if (assignedLevel > inviterLevel) {
      return res.status(403).json({ error: `A ${membership.role} cannot invite someone with a ${role} role` });
    }

    const existingMember = await storage.getCompanyMemberByEmail(companyId, email);
    if (existingMember) {
      return res.status(400).json({ error: "This person is already a member of this company" });
    }

    const existingInvite = await storage.getCompanyInvitationByEmail(companyId, email);
    if (existingInvite) {
      if (new Date(existingInvite.expiresAt) < new Date()) {
        await storage.updateCompanyInvitation(existingInvite.id, { status: 'expired' });
      } else {
        return res.status(400).json({ error: "An invitation has already been sent to this email" });
      }
    }

    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const userProfile = await storage.getUserProfileByCognitoSub(userId);
    const inviterName = userProfile?.displayName || 'A team member';

    const invitation = await storage.createCompanyInvitation({
      companyId,
      email,
      role: role || 'EMPLOYEE',
      department: department || null,
      token,
      invitedBy: userId,
      invitedByName: inviterName,
      status: 'pending',
      expiresAt,
    });

    await storage.createTeamMember({
      name,
      email,
      role: (role || 'EMPLOYEE') as any,
      department: (department || 'General') as any,
      departmentId: null,
      avatar: null,
      status: 'invited',
      companyId,
      userId: null,
      joinedAt: new Date().toISOString().split('T')[0],
      permissions: getPermissionsForRole(role || 'EMPLOYEE'),
    });

    const emailResult = await notificationService.sendTeamInvite({
      email,
      name,
      role: role || 'Employee',
      department: department || undefined,
      invitedBy: inviterName,
      companyName: company.name,
      inviteToken: token,
    });

    res.status(201).json({
      ...invitation,
      inviteEmailSent: emailResult.success,
      inviteEmailError: emailResult.success ? undefined : emailResult.error,
    });
  } catch (error) {
    console.error('Create invitation error:', error);
    res.status(500).json({ error: "Failed to create invitation" });
  }
});

router.get("/companies/:id/invitations", requireAuth, async (req, res) => {
  try {
    const invitations = await storage.getCompanyInvitations(param(req.params.id));
    res.json(invitations);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch invitations" });
  }
});

router.get("/invitations/:token", async (req, res) => {
  try {
    const invitation = await storage.getCompanyInvitationByToken(param(req.params.token));
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: `This invitation has been ${invitation.status}` });
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      await storage.updateCompanyInvitation(invitation.id, { status: 'expired' });
      return res.status(400).json({ error: "This invitation has expired" });
    }

    const company = await storage.getCompany(invitation.companyId);

    res.json({
      email: invitation.email,
      role: invitation.role,
      department: invitation.department,
      companyName: company?.name || 'Unknown Company',
      companyLogo: company?.logo,
      invitedByName: invitation.invitedByName,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to validate invitation" });
  }
});

router.post("/invitations/:token/accept", requireAuth, async (req, res) => {
  try {
    const invitation = await storage.getCompanyInvitationByToken(param(req.params.token));
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: `This invitation has already been ${invitation.status}` });
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      await storage.updateCompanyInvitation(invitation.id, { status: 'expired' });
      return res.status(400).json({ error: "This invitation has expired" });
    }

    const userId = (req as any).user?.uid || (req as any).user?.id;
    const userEmail = (req as any).user?.email;

    if (invitation.email.toLowerCase() !== userEmail?.toLowerCase()) {
      return res.status(403).json({ error: "This invitation was sent to a different email address" });
    }

    const result = await storage.acceptInvitationTransaction({
      invitationId: invitation.id,
      companyId: invitation.companyId,
      userId,
      email: invitation.email,
      role: invitation.role,
      createdAt: invitation.createdAt,
    });

    // Notify the admin who sent the invite
    try {
      if (invitation.invitedBy) {
        const userProfile = await storage.getUserProfileByCognitoSub(userId);
        const memberName = userProfile?.displayName || invitation.email;
        await notificationService.notifyInviteAccepted(
          invitation.invitedBy, memberName, result.companyName || 'the company'
        );

        // Also send email to the inviter
        const inviterProfile = await storage.getUserProfileByCognitoSub(invitation.invitedBy);
        if (inviterProfile?.email) {
          notificationService.sendInviteAcceptedEmail({
            email: inviterProfile.email,
            adminName: inviterProfile.displayName || 'Admin',
            memberName,
            memberEmail: invitation.email,
            role: invitation.role,
            companyName: result.companyName || 'your company',
          }).catch(console.error);
        }
      }
    } catch (notifErr) {
      console.warn('Invite acceptance notification failed:', notifErr);
    }

    res.json({
      message: "Invitation accepted successfully",
      companyId: invitation.companyId,
      companyName: result.companyName,
      role: invitation.role,
      walletId: result.walletId,
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: "Failed to accept invitation" });
  }
});

router.delete("/companies/:companyId/invitations/:invitationId", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.uid || (req as any).user?.id;
    const membership = await storage.getCompanyMember(param(req.params.companyId), userId);
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return res.status(403).json({ error: "Only admins can revoke invitations" });
    }

    const success = await storage.revokeCompanyInvitation(param(req.params.invitationId));
    if (!success) {
      return res.status(404).json({ error: "Invitation not found" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to revoke invitation" });
  }
});

export default router;
