import React from "react";
import { Label } from "@/components/ui/label";

interface FieldProps {
    label: string;
    required?: boolean;
    children: React.ReactNode;
    hint?: string;
}

export function Field({
    label,
    required,
    children,
    hint,
}: FieldProps) {
    return (
        <div className="space-y-1">
            <Label className="text-slate-900 font-semibold text-sm">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            {children}
            {hint && <p className="text-slate-500 text-xs">{hint}</p>}
        </div>
    );
}
