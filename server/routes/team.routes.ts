import express from "express";
import crypto from "crypto";
import { param, resolveUserCompany, verifyCompanyAccess, teamMemberSchema, teamMemberUpdateSchema } from "./shared";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { storage } from "../storage";
import { notificationService } from "../services/notification-service";
import { checkRoleHierarchy } from "../lib/role-hierarchy";

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

// S-F-01 helpers live in server/lib/role-hierarchy.ts so they can be
// imported by tests without pulling in storage / db. See that file
// for the rationale + the audit reference.

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

    const assignedRole = role || 'EMPLOYEE';

    // S-F-01 — role hierarchy guard. Refuse if the caller would
    // assign a role HIGHER than their own. Without this guard an
    // ADMIN can invite a new OWNER and chain into a tenant takeover.
    const callerRole = (req as any).adminUser?.role;
    const hierarchyError = checkRoleHierarchy(callerRole, assignedRole);
    if (hierarchyError) {
      return res.status(hierarchyError.status).json(hierarchyError.body);
    }

    // Resolve company context for the current user
    const companyCtx = await resolveUserCompany(req);
    const companyId = companyCtx?.companyId || null;

    const existingMembers = await storage.getTeamMembersByEmail(email);
    const sameDepMember = existingMembers?.find(m => m.department === (department || 'General'));
    if (sameDepMember) {
      return res.status(400).json({ error: "This person is already in this department" });
    }

    const member = await storage.createTeamMember({
      name,
      email,
      role: assignedRole as any,
      department: (department || 'General') as any,
      departmentId: null,
      avatar: null,
      status: 'invited',
      joinedAt: new Date().toISOString().split('T')[0],
      permissions: getPermissionsForRole(assignedRole),
      userId: null,
      companyId,
    });

    // Create a company invitation with token so the invite email links properly
    let inviteToken: string | undefined;
    let companyName = 'your team';
    const userId = (req as any).user?.uid || (req as any).user?.id;

    if (companyId) {
      const company = await storage.getCompany(companyId);
      companyName = company?.name || 'your team';

      const userProfile = await storage.getUserProfileByCognitoSub(userId);
      const inviterName = userProfile?.displayName || 'A team member';

      inviteToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await storage.createCompanyInvitation({
        companyId,
        email,
        role: assignedRole,
        department: department || null,
        token: inviteToken,
        invitedBy: userId,
        invitedByName: inviterName,
        status: 'pending',
        expiresAt,
      });
    }

    // Send team invite email with token and company info
    const emailResult = await notificationService.sendTeamInvite({
      email,
      name,
      role: assignedRole,
      department: department || undefined,
      companyName,
      inviteToken,
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

    // S-F-01 — role hierarchy guard on update. An ADMIN cannot promote
    // a member to a role higher than ADMIN. Same rationale as POST /team.
    const callerRole = (req as any).adminUser?.role;
    const hierarchyError = checkRoleHierarchy(callerRole, result.data.role);
    if (hierarchyError) {
      return res.status(hierarchyError.status).json(hierarchyError.body);
    }

    const originalMember = await storage.getTeamMember(param(req.params.id));
    if (!originalMember) {
      return res.status(404).json({ error: "Team member not found" });
    }

    // S-F-01 extension — also block demoting a member whose CURRENT role
    // outranks the caller. Otherwise an ADMIN could demote the OWNER.
    if (originalMember.role) {
      const reversedError = checkRoleHierarchy(callerRole, originalMember.role);
      if (reversedError) {
        return res.status(403).json({
          error: `Cannot modify a member whose role '${originalMember.role}' outranks your own role '${callerRole}'`,
          code: 'ROLE_HIERARCHY_VIOLATION',
          callerRole,
          targetCurrentRole: originalMember.role,
        });
      }
    }

    // AUD-DD-TEAM-005 — last-admin guard. If the change demotes the
    // last remaining OWNER/ADMIN, refuse it. Without this an ADMIN
    // could demote the OWNER and leave the company with no one able
    // to administer it.
    const newRole = result.data.role;
    const wasAdminLevel = ['OWNER', 'ADMIN'].includes(String(originalMember.role).toUpperCase());
    const willStayAdminLevel = newRole && ['OWNER', 'ADMIN'].includes(String(newRole).toUpperCase());
    if (wasAdminLevel && newRole && !willStayAdminLevel && (originalMember as any).companyId) {
      const team = await storage.getTeam((originalMember as any).companyId);
      const otherAdminCount = team.filter((m: any) =>
        m.id !== originalMember.id &&
        m.status === 'active' &&
        ['OWNER', 'ADMIN'].includes(String(m.role).toUpperCase())
      ).length;
      if (otherAdminCount === 0) {
        return res.status(409).json({
          error: 'Cannot demote the last admin/owner of this company. Promote another member first.',
          code: 'LAST_ADMIN_GUARD',
        });
      }
    }

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
    const target = await storage.getTeamMember(param(req.params.id));

    // S-F-01 — block deleting a member whose role outranks the caller.
    // Prevents ADMIN from removing OWNER as a takeover step.
    const callerRole = (req as any).adminUser?.role;
    if (target?.role) {
      const reversedError = checkRoleHierarchy(callerRole, target.role);
      if (reversedError) {
        return res.status(403).json({
          error: `Cannot remove a member whose role '${target.role}' outranks your own role '${callerRole}'`,
          code: 'ROLE_HIERARCHY_VIOLATION',
          callerRole,
          targetCurrentRole: target.role,
        });
      }
    }

    // AUD-DD-TEAM-005 — last-admin guard on delete. Same logic as on
    // patch: refuse to remove the last OWNER/ADMIN of a company.
    if (target && (target as any).companyId && ['OWNER', 'ADMIN'].includes(String(target.role).toUpperCase())) {
      const team = await storage.getTeam((target as any).companyId);
      const otherAdminCount = team.filter((m: any) =>
        m.id !== target.id &&
        m.status === 'active' &&
        ['OWNER', 'ADMIN'].includes(String(m.role).toUpperCase())
      ).length;
      if (otherAdminCount === 0) {
        return res.status(409).json({
          error: 'Cannot remove the last admin/owner of this company. Promote another member first.',
          code: 'LAST_ADMIN_GUARD',
        });
      }
    }

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
