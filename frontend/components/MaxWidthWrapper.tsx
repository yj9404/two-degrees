"use client";

import { usePathname } from "next/navigation";

export default function MaxWidthWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAdmin = pathname.startsWith("/admin");

    if (isAdmin) {
        return <>{children}</>;
    }

    return (
        <div className="flex-1 w-full max-w-md mx-auto bg-white shadow-sm ring-1 ring-slate-200">
            {children}
        </div>
    );
}
