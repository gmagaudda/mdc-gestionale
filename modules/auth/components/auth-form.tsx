"use client";
import { WriteButton } from "@/components/pwa/write-button";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Input } from "@/components/arc/input/input";
import { PasswordField } from "@/components/arc/password-field/password-field";
import { PasswordStrength } from "@/components/arc/password-strength/password-strength";
import { Alert } from "@/components/arc/alert/alert";
import { login, requestReset, setPassword } from "../actions";
import { emailSchema, loginSchema, passwordSchema } from "../schema";

type Values = { email: string; password: string; confirm: string };
export function AuthForm({
  mode,
  next,
  initialError,
}: {
  mode: "login" | "reset" | "password";
  next?: string;
  initialError?: string;
}) {
  const t = useTranslations("auth");
  const { register, handleSubmit, setFocus, control } = useForm<Values>({
    defaultValues: { email: "", password: "", confirm: "" },
  });
  const currentPassword = useWatch({ control, name: "password" });
  const [error, setError] = useState(initialError);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const submit = handleSubmit((values) => {
    const parsed = (
      mode === "login"
        ? loginSchema
        : mode === "reset"
          ? emailSchema
          : passwordSchema
    ).safeParse(values);
    setError(undefined);
    setFields({});
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        errors[String(issue.path[0])] = t(
          issue.path[0] === "email"
            ? "emailError"
            : issue.path[0] === "confirm"
              ? "confirmError"
              : "passwordRules",
        );
      setFields(errors);
      setFocus(parsed.error.issues[0].path[0] as keyof Values);
      return;
    }
    startTransition(async () => {
      try {
        const result =
          mode === "login"
            ? await login(values, next)
            : mode === "reset"
              ? await requestReset(values)
              : await setPassword(values);
        if (!result.ok) setError(result.error);
        else setSent(true);
      } catch {
        setError("unavailable");
      }
    });
  });
  const revealMessages = {
    showPassword: t("showPassword"),
    hidePassword: t("hidePassword"),
  };
  return (
    <form onSubmit={submit} noValidate className="stack">
      {mode !== "password" && (
        <Input
          label={t("email")}
          type="email"
          autoComplete="email"
          {...register("email")}
          error={fields.email}
          required
        />
      )}
      {mode === "login" && (
        <div className="secret-field">
          <PasswordField
            label={t("password")}
            autoComplete="current-password"
            messages={revealMessages}
            {...register("password")}
            required
            aria-invalid={Boolean(fields.password)}
            aria-describedby={fields.password ? "password-error" : undefined}
          />
        </div>
      )}
      {mode === "password" && (
        <>
          <div className="secret-field">
            <PasswordStrength
              label={t("newPassword")}
              autoComplete="new-password"
              {...register("password")}
              value={currentPassword}
              error={fields.password}
              shortLength={10}
              rules={[
                {
                  id: "length",
                  label: t("passwordRules"),
                  test: (value) => value.length >= 10,
                },
              ]}
              messages={{
                levels: {
                  tooShort: t("tooShort"),
                  weak: t("weak"),
                  fair: t("fair"),
                  good: t("good"),
                  strong: t("strong"),
                },
                showPassword: t("showPassword"),
                meterLabel: t("strength"),
                noPassword: t("noPassword"),
                rulesLabel: t("rules"),
                ruleMet: t("ruleMet"),
                ruleNotMet: t("ruleNotMet"),
                remainingPrefix: t("remaining"),
                remainingSuffix: t("characters"),
                summary: ({ label }) => t("strengthSummary", { label }),
              }}
            />
          </div>
          <div className="secret-field">
            <PasswordField
              label={t("confirmPassword")}
              autoComplete="new-password"
              messages={revealMessages}
              {...register("confirm")}
              required
              aria-invalid={Boolean(fields.confirm)}
              aria-describedby={fields.confirm ? "confirm-error" : undefined}
            />
          </div>
          {fields.confirm && (
            <p id="confirm-error" role="alert">
              {fields.confirm}
            </p>
          )}
        </>
      )}
      {mode === "login" && fields.password && (
        <p id="password-error" role="alert">
          {fields.password}
        </p>
      )}
      <Alert
        open={Boolean(error || sent)}
        tone={error ? "danger" : "success"}
        title={error ? t(error) : t("resetSent")}
      />
      <WriteButton type="submit" size="lg" loading={pending} disabled={pending}>
        {t(
          mode === "login"
            ? "signIn"
            : mode === "reset"
              ? "sendReset"
              : "savePassword",
        )}
      </WriteButton>
    </form>
  );
}
