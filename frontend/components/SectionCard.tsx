import React from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";

interface SectionCardProps {
    title: string;
    description?: string;
    children: React.ReactNode;
}

export function SectionCard({
    title,
    description,
    children,
}: SectionCardProps) {
    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-4">
                <CardTitle className="text-slate-900 font-semibold text-base">
                    {title}
                </CardTitle>
                {description && (
                    <CardDescription className="text-slate-500 text-sm">
                        {description}
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent className="space-y-4">{children}</CardContent>
        </Card>
    );
}
