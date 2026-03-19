"use client";

import React, { useEffect } from "react";
import { MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Critical Runtime Error:", error);
    }, [error]);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
            <div className="space-y-6 max-w-sm">
                <div className="space-y-4">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto animate-pulse">
                        <RefreshCw size={32} />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">잠시 오류가 발생했습니다.</h2>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            처리 중 문제가 발생하여 잠시 후 다시 시도해 주세요.<br/>지속될 경우 주선자에게 문의해 주십시오.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                    <Button 
                        onClick={() => reset()}
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl gap-2"
                    >
                        <RefreshCw size={18} />
                        다시 시도하기
                    </Button>
                    
                    <a 
                        href="http://pf.kakao.com/_jnxiZX/chat"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full h-12 flex items-center justify-center gap-2 bg-[#FEE500] hover:bg-[#F7E100] text-[#191919] font-bold rounded-xl text-sm transition-all active:scale-95 shadow-sm"
                    >
                        <MessageCircle size={18} fill="#191919" />
                        주선자에게 오류 제보하기
                    </a>
                </div>
            </div>
        </div>
    );
}
