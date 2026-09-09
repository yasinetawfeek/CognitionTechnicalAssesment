/**
 * App registry. Add your app's manifest here (or run `npm run create-app <id>`).
 * Order controls sidebar order within each category.
 */
import type { AppManifest } from "@/kernel/apps/types";
import { playgroundApp } from "./playground/manifest";
import { approvalsApp } from "./approvals/manifest";
import { flagsApp } from "./flags/manifest";
import { builderApp } from "./builder/manifest";
import { adminApp } from "./admin/manifest";
import { auditApp } from "./audit/manifest";
import { systemApp } from "./system/manifest";
import { kycApp } from "./kyc/manifest";

export const apps: AppManifest[] = [playgroundApp, builderApp, approvalsApp, flagsApp, adminApp, auditApp, systemApp, kycApp];
