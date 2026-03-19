import express from "express";
import { param, resolveUserCompany, verifyCompanyAccess, teamMemberSchema, teamMemberUpdateSchema } from "./shared";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { storage } from "../storage";
import { notificationService } from "../services/notification-service";

const router = express.Router();

// ==================== TEAM ====================
router.get("/team", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const team = await storage.getTeam(company?.companyId);
    res.json(team);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch team" });
  }
});

router.get("/team/:id", requireAuth, async (req, res) => {
  try {
    const company = await resolveUserCompany(req);
    const member = await storage.getTeamMember(param(req.params.id));
    if (!member) {
      return res.status(404).json({ error: "Team member not found" });
    }
    if (company && !await verifyCompanyAccess(member.companyId, company.companyId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch team member" });
  }
});

router.post("/team", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = teamMemberSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid team member data", details: result.error.issues });
    }
    const { name, email, role, department } = result.data;

    const existingMembers = await storage.getTeamMembersByEmail(email);
    const sameDepMember = existingMembers?.find(m => m.department === (department || 'General'));
    if (sameDepMember) {
      return res.status(400).json({ error: "This person is already in this department" });
    }

    const member = await storage.createTeamMember({
      name,
      email,
      role: (role || 'EMPLOYEE') as any,
      department: (department || 'General') as any,
      departmentId: null,
      avatar: null,
      status: 'active',
      joinedAt: new Date().toISOString().split('T')[0],
      permissions: ['CREATE_EXPENSE'],
      userId: null,
      companyId: null,
    });

    // Send team invite email
    const emailResult = await notificationService.sendTeamInvite({
      email,
      name,
      role: role || 'Employee',
      department: department || undefined,
    });

    if (!emailResult.success) {
      console.warn('Team invite email failed:', emailResult.error);
    }

    res.status(201).json({
      ...member,
      inviteEmailSent: emailResult.success,
      inviteEmailError: emailResult.success ? undefined : emailResult.error
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create team member" });
  }
});

router.patch("/team/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = teamMemberUpdateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid team member data", details: result.error.issues });
    }
    const originalMember = await storage.getTeamMember(param(req.params.id));
    const member = await storage.updateTeamMember(param(req.params.id), result.data as any);
    if (!member) {
      return res.status(404).json({ error: "Team member not found" });
    }

    // Notify if role changed
    if (originalMember && result.data.role && result.data.role !== originalMember.role && member.userId) {
      const company = await resolveUserCompany(req);
      const companyData = company?.companyId ? await storage.getCompany(company.companyId) : null;
      notificationService.notifyRoleChanged(
        member.userId, originalMember.role, result.data.role, companyData?.name || 'your company'
      ).catch(console.error);

      if (member.email) {
        notificationService.sendRoleChangedEmail({
          email: member.email,
          name: member.name,
          oldRole: originalMember.role,
          newRole: result.data.role,
          companyName: companyData?.name || 'your company',
        }).catch(console.error);
      }
    }

    res.json(member);
  } catch (error) {
    res.status(500).json({ error: "Failed to update team member" });
  }
});

router.delete("/team/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const deleted = await storage.deleteTeamMember(param(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: "Team member not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete team member" });
  }
});

export default router;
