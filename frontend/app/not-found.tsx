"use client";

import React from "react";
import Link from "next/link";
import { MessageCircle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
            <div className="space-y-6 max-w-sm">
                <div className="space-y-2">
                    <h1 className="text-6xl font-black text-slate-200">404</h1>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">길을 잃으셨나요?</h2>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        요청하신 페이지가 존재하지 않거나,<br/>만료된 링크일 수 있습니다.
                    </p>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                    <Link href="/">
                        <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl gap-2">
                            <Home size={18} />
                            메인으로 돌아가기
                        </Button>
                    </Link>
                    
                    <a 
                        href="http://pf.kakao.com/_jnxiZX/chat"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full h-12 flex items-center justify-center gap-2 bg-[#FEE500] hover:bg-[#F7E100] text-[#191919] font-bold rounded-xl text-sm transition-all active:scale-95 shadow-sm"
                    >
                        <MessageCircle size={18} fill="#191919" />
                        주선자에게 도움 요청하기
                    </a>
                </div>
            </div>
        </div>
    );
}
