"use client";

import { useRouter } from "next/navigation";
import { ActionForm, Button, Checkbox, Dialog, Field, FieldError, Input, Select, SubmitButton } from "@/kernel/ui";
import { createCaseAction } from "../actions";
import { DOCUMENT_TYPES } from "../types";

export function CreateCaseDialog() {
  const router = useRouter();
  return (
    <Dialog trigger={<Button>New case</Button>} title="Create KYC case" description="Normally cases arrive from the onboarding flow; this form lets you add one by hand for testing.">
      {(close) => (
        <ActionForm
          action={createCaseAction}
          onSuccess={(state) => {
            close();
            if (state.data?.id) router.push(`/kyc/${state.data.id}`);
          }}
          resetOnSuccess
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Applicant name" htmlFor="applicantName">
              <Input id="applicantName" name="applicantName" required autoFocus />
              <FieldError name="applicantName" />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" required />
              <FieldError name="email" />
            </Field>
            <Field label="Country" htmlFor="country" hint="ISO code, e.g. GB. Try IR or NG for higher risk.">
              <Input id="country" name="country" maxLength={2} defaultValue="GB" required className="uppercase" />
              <FieldError name="country" />
            </Field>
            <Field label="Date of birth" htmlFor="dateOfBirth">
              <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
              <FieldError name="dateOfBirth" />
            </Field>
            <Field label="Document type" htmlFor="documentType">
              <Select id="documentType" name="documentType" defaultValue="PASSPORT">
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Document number" htmlFor="documentNumber">
              <Input id="documentNumber" name="documentNumber" required />
              <FieldError name="documentNumber" />
            </Field>
            <Field label="Declared annual income" htmlFor="declaredIncome">
              <Input id="declaredIncome" name="declaredIncome" type="number" min={0} step="100" defaultValue="45000" required />
              <FieldError name="declaredIncome" />
            </Field>
            <Field label="Initial deposit" htmlFor="initialDeposit" hint="Large deposits vs income or vs the rest of the queue raise the score.">
              <Input id="initialDeposit" name="initialDeposit" type="number" min={0} step="100" defaultValue="2000" required />
              <FieldError name="initialDeposit" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <label className="inline-flex items-center gap-2">
              <Checkbox name="pepMatch" /> PEP match
            </label>
            <label className="inline-flex items-center gap-2">
              <Checkbox name="sanctionsHit" /> Sanctions hit
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <SubmitButton pendingText="Creating…">Create case</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Dialog>
  );
}
