"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

interface AgreementModalProps {
    forced?: boolean;
}

export default function AgreementModal({ forced = false }: AgreementModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [agreed, setAgreed] = useState(false);

    useEffect(() => {
        if (forced) {
            setIsOpen(true);
        } else {
            // 세션이 유지되는 동안 이미 한 번 동의했다면 다시 열리지 않도록 설정
            const hasAgreed = sessionStorage.getItem("twoDegreesAgreed");
            if (!hasAgreed) {
                setIsOpen(true);
            }
        }
    }, [forced]);

    const handleAgree = () => {
        sessionStorage.setItem("twoDegreesAgreed", "true");
        setIsOpen(false);
    };

    const handleDecline = () => {
        // 거절 시 구글로 리다이렉트하거나 이전 페이지(있다면)로 돌아가기
        if (window.history.length > 2) {
            window.history.back();
        } else {
            window.location.href = "https://www.google.com";
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={() => { }}>
            <DialogContent
                // 배경 인터랙션 클릭 방지, 모달 밖 클릭이나 Esc 키로 닫히지 못하게 억제합니다.
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
                className="w-[95vw] max-w-md rounded-xl p-6 shadow-xl"
                showCloseButton={false}
            >
                <DialogHeader className="mb-2">
                    <DialogTitle className="text-xl font-bold text-slate-900">
                        가입 조건 확인: 지인 기반 폐쇄형 매칭 풀
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4 text-[15px] text-slate-700 leading-relaxed font-medium tracking-tight break-keep border-y border-slate-100">
                    <p>
                        TwoDegrees는 신뢰할 수 있는 만남을 위해 철저한 초대 및 지인 인증 기반으로 운영됩니다.
                    </p>
                    <p>
                        현재 본 서비스는 <strong>'이영진'</strong> 또는{" "}
                        <strong>'황보송'</strong>의 직접적인 지인, 혹은 그 지인의 지인(2단계)까지만 등록할 수 있습니다.
                    </p>
                    <p className="text-red-500 font-semibold bg-red-50 p-3 rounded-lg">
                        가입 시 링크를 전달해 준 추천인의 실명을 반드시 기재해야 합니다. 확인되지 않은 외부 인원의 임의 가입이나 허위 추천인 기재가 적발될 경우, 사전 통보 없이 매칭 풀에서 삭제됩니다.
                    </p>
                </div>

                <div className="flex items-start space-x-3 py-4">
                    <Checkbox
                        id="agreement"
                        checked={agreed}
                        onCheckedChange={(checked) => setAgreed(checked as boolean)}
                        className="mt-1 w-5 h-5"
                    />
                    <label
                        htmlFor="agreement"
                        className="text-sm font-semibold leading-relaxed text-slate-800 cursor-pointer select-none"
                    >
                        본인이 이영진 또는 황보송의 지인(또는 지인의 지인)이며, 위 운영 원칙에 동의합니다.
                    </label>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:gap-2 pt-2">
                    <Button
                        variant="outline"
                        className="w-full sm:w-1/3 order-2 sm:order-1"
                        onClick={handleDecline}
                    >
                        나가기
                    </Button>
                    <Button
                        className="w-full sm:w-2/3 bg-blue-600 hover:bg-blue-700 text-white font-semibold order-1 sm:order-2"
                        disabled={!agreed}
                        onClick={handleAgree}
                    >
                        동의하고 프로필 등록하기
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
