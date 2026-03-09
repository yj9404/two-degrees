"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserCircle } from "lucide-react";

export default function Header() {
    const pathname = usePathname();

    const menuItems = [
        { label: "서비스 소개", href: "/" },
        // { label: "공지사항", href: "#" },
        { label: "매칭 현황", href: "/matching-status" },
        { label: "가입하기", href: "/register" },
        { label: "내 정보 수정", href: "/auth" },
    ].filter(item => item !== undefined); // Simple way to handle commented out if needed, but here I'll just remove the commented line or keep it literally.
    // Actually, I'll just remove the item from the active array but keep the comment in the source if I want, 
    // but the user said "주석처리", so I will literally comment it out in the code.

    const activeMenuItems = [
        { label: "서비스 소개", href: "/" },
        // { label: "공지사항", href: "#" },
        { label: "매칭 현황", href: "/matching-status" },
        { label: "가입하기", href: "/register" },
        { label: "내 정보 수정", href: "/auth" },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
            <div className="max-w-screen-md mx-auto px-4 h-16 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <span className="text-xl font-bold text-slate-900 tracking-tighter">
                        Two<span className="text-blue-600">Degrees</span>
                    </span>
                </Link>

                <nav className="hidden sm:flex items-center gap-6">
                    {activeMenuItems.map((item) => (
                        <Link
                            key={item.href + item.label}
                            href={item.href}
                            className={cn(
                                "text-sm font-medium transition-colors hover:text-blue-600",
                                pathname === item.href ? "text-blue-600" : "text-slate-500"
                            )}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="flex items-center gap-2">
                    <Link href="/register" className="hidden xs:block">
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 px-4 rounded-xl">
                            가입하기
                        </Button>
                    </Link>
                    <Link href="/auth">
                        <Button variant="ghost" size="sm" className="text-slate-600 font-semibold gap-1.5 px-2">
                            <UserCircle size={18} />
                            <span className="hidden xs:inline">내 정보 관리</span>
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Scrollable Horizontal Menu for Mobile-level width */}
            <div className="border-t border-slate-100 bg-white/50 overflow-x-auto no-scrollbar sm:hidden">
                <nav className="flex items-center px-4 h-10 gap-6 min-w-max">
                    {activeMenuItems.map((item) => (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                                "text-[13px] font-semibold transition-colors whitespace-nowrap",
                                pathname === item.href ? "text-blue-600" : "text-slate-500"
                            )}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </div>
        </header>
    );
}
