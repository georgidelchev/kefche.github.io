import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";

import { Input } from "@kefche/ui/components/input";
import { cn } from "@kefche/ui/lib/cn";

interface FieldTextProps {
  id: string;
  hint?: string | undefined;
  error?: string | undefined;
  /** Positive feedback shown when there's no error (e.g. "nickname available"). */
  success?: string | undefined;
}

const describedBy = ({ id, hint, error, success }: FieldTextProps) =>
  [hint && `${id}-hint`, error && `${id}-error`, !error && success && `${id}-success`]
    .filter(Boolean)
    .join(" ") || undefined;

function FieldText({ id, hint, error, success }: FieldTextProps) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : (
        success && (
          <p id={`${id}-success`} role="status" className="text-sm font-semibold text-success">
            {success}
          </p>
        )
      )}
    </>
  );
}

type TextFieldProps = FieldTextProps & { label: string } & Omit<ComponentProps<"input">, "id">;

/** Labeled input with hint and error text wired to aria-describedby. */
export function TextField({ id, label, hint, error, success, ...input }: TextFieldProps) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ id, hint, error, success })}
        {...input}
      />
      <FieldText id={id} hint={hint} error={error} success={success} />
    </div>
  );
}

type PasswordFieldProps = TextFieldProps & { showLabel: string; hideLabel: string };

/** Password input with a show/hide toggle. */
export function PasswordField({ showLabel, hideLabel, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const { id, label, hint, error, success, className, ...input } = props;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy({ id, hint, error, success })}
          className={cn("pe-12", className)}
          {...input}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-label={visible ? hideLabel : showLabel}
          onClick={() => {
            setVisible((v) => !v);
          }}
          className="absolute inset-y-0 end-0 flex w-11 cursor-pointer items-center justify-center rounded-e-xl text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-5" />
          ) : (
            <Eye aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>
      <FieldText id={id} hint={hint} error={error} success={success} />
    </div>
  );
}

const selectClass =
  "min-h-11 w-full min-w-0 cursor-pointer rounded-xl border border-border-strong bg-surface-2 px-3 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-invalid:border-danger";

interface BirthDateFieldProps {
  id: string;
  legend: string;
  monthLabel: string;
  yearLabel: string;
  /** Month names, January first, in the page's language. */
  monthNames: readonly string[];
  hint: string;
  error?: string | undefined;
  month: ComponentProps<"select">;
  year: ComponentProps<"select">;
}

/** Month + year selects; only the year is stored (SPEC §7.1). */
export function BirthDateField(props: BirthDateFieldProps) {
  const { id, legend, monthLabel, yearLabel, monthNames, hint, error, month, year } = props;
  const [years] = useState(() => {
    const thisYear = new Date().getFullYear();
    return Array.from({ length: thisYear - 1900 + 1 }, (_, i) => thisYear - i);
  });
  const aria = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy({ id, hint, error }),
  } as const;
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 font-semibold">{legend}</legend>
      <div className="grid grid-cols-[3fr_2fr] gap-2">
        <div className="grid gap-1">
          <label htmlFor={`${id}-month`} className="text-sm text-muted">
            {monthLabel}
          </label>
          <select id={`${id}-month`} className={selectClass} {...aria} {...month}>
            <option value="">–</option>
            {monthNames.map((name, i) => (
              <option key={name} value={String(i + 1)}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${id}-year`} className="text-sm text-muted">
            {yearLabel}
          </label>
          <select id={`${id}-year`} className={selectClass} {...aria} {...year}>
            <option value="">–</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      <FieldText id={id} hint={hint} error={error} />
    </fieldset>
  );
}

/** Form-level message: errors are announced assertively, notices politely. */
export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl border p-3 text-sm font-semibold",
        tone === "error" ? "border-danger text-danger" : "border-success text-success",
      )}
    >
      {children}
    </div>
  );
}
