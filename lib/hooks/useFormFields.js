"use client";

import { useCallback, useState } from "react";

/**
 * Form values + per-field error messages.
 *
 * - `validate(values)` returns { field: message } for every field that is not OK.
 * - A field's message shows once the user has left it (blur) or pressed submit,
 *   so an empty form is not covered in red on first load.
 * - Server errors ({ ok: false, field, error } from an action) are shown under
 *   their field and cleared as soon as that field changes.
 *
 *   const form = useFormFields(EMPTY, validate);
 *   <Input {...form.bind("email")} />   <Field error={form.errorFor("email")} />
 *   onSubmit: if (!form.isValid) form.revealErrors(event.currentTarget)
 */
export function useFormFields(initial, validate) {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});

  const errors = validate(values);
  const isValid = Object.keys(errors).length === 0;

  const setValue = useCallback((key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setServerErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  }, []);

  const touch = (key) => setTouched((current) => (current[key] ? current : { ...current, [key]: true }));

  /** Props for an input: value/checked, onChange, onBlur. */
  const bind = (key) => {
    if (typeof initial[key] === "boolean") {
      return {
        checked: values[key],
        onChange: (event) => {
          setValue(key, event.target.checked);
          touch(key);
        },
      };
    }
    return { value: values[key], onChange: (event) => setValue(key, event.target.value), onBlur: () => touch(key) };
  };

  const errorFor = (key) => serverErrors[key] ?? (touched[key] ? errors[key] : undefined);

  /** Shows every field's message and moves focus to the first field in `formElement` that needs fixing. */
  const revealErrors = (formElement) => {
    setTouched(Object.fromEntries(Object.keys(initial).map((key) => [key, true])));
    focusFirstInvalid(formElement);
  };

  /** Puts a server-side message under its field. Returns false if the message belongs to no field. */
  const setServerError = (field, message, formElement) => {
    if (!field || !(field in initial)) return false;
    setServerErrors((current) => ({ ...current, [field]: message }));
    focusFirstInvalid(formElement);
    return true;
  };

  return { values, setValue, bind, errors, errorFor, isValid, revealErrors, setServerError };
}

/** After the next render (when aria-invalid is set), focus the first field marked invalid. */
function focusFirstInvalid(formElement) {
  if (!formElement) return;
  requestAnimationFrame(() => formElement.querySelector('[aria-invalid="true"]')?.focus());
}
