"use client";

import React from "react";

export default function Footer() {
    const KAKAO_CHAT_URL = "http://pf.kakao.com/_jnxiZX/chat";
    
    return (
        <footer className="py-12 bg-slate-50 border-t border-slate-200">
            <div className="max-w-md mx-auto px-6 text-center space-y-4">
                <div className="space-y-1">
                    <p className="text-slate-900 font-bold text-sm tracking-tight">TwoDegrees</p>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                        당신과 두 다리 건너 만나는 인연. 신뢰할 수 있는 소개팅 풀 매칭 서비스
                    </p>
                </div>
                
                <div className="pt-2">
                    <a 
                        href={KAKAO_CHAT_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-[#FEE500] hover:bg-[#F7E100] text-[#191919] text-xs font-bold py-2 px-4 rounded-full transition-all shadow-sm active:scale-95"
                    >
                        <span>💬 문의: TwoDegrees 카카오톡 채널</span>
                    </a>
                </div>

                <div className="pt-4 border-t border-slate-200/60">
                    <p className="text-slate-400 text-[10px] font-medium uppercase tracking-widest">
                        TwoDegrees v1.2.0 · © 2026 Team TwoDegrees
                    </p>
                </div>
            </div>
        </footer>
    );
}
