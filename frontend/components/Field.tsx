import React from "react";
import { Label } from "@/components/ui/label";

interface FieldProps {
    label: string;
    required?: boolean;
    children: React.ReactNode;
    hint?: string;
    isPublic?: boolean;
}

export function Field({
    label,
    required,
    children,
    hint,
    isPublic,
}: FieldProps) {
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-1.5 mb-1.5">
                <Label className="text-slate-900 font-semibold text-sm">
                    {label}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                </Label>
                {isPublic && (
                    <span className="inline-flex items-center text-[10px] opacity-70" title="공유 시 노출됨">
                        🌐
                    </span>
                )}
            </div>
            {children}
            {hint && <p className="text-slate-500 text-xs">{hint}</p>}
        </div>
    );
}
