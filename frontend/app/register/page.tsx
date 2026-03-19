import type { Metadata } from "next";
import RegistrationForm from "@/components/RegistrationForm";
import AgreementModal from "@/components/AgreementModal";

export const metadata: Metadata = {
    title: "TwoDegrees – 소개팅 풀 등록",
    description: "지인 소개 기반 소개팅 풀에 등록하고 인연을 찾아보세요.",
};

export default function RegisterPage() {
    return (
        <main className="min-h-[100dvh] py-8 px-4">
            {/* 가입 조건 동의 팝업 (가입 페이지 진입 시 무조건 표시) */}
            <AgreementModal forced={true} />

            <div className="space-y-6">
                {/* 헤더 */}
                <div className="text-center space-y-1">
                    <h1 className="text-slate-900 font-semibold text-2xl tracking-tight">
                        TwoDegrees 💑
                    </h1>
                    <p className="text-slate-500 text-sm">
                        소개팅 풀 등록
                    </p>
                    <div className="pt-2">
                        <a
                            href="/auth"
                            className="inline-block text-blue-600 text-sm font-semibold hover:underline"
                        >
                            이미 등록하셨나요? 프로필 수정하기 →
                        </a>
                    </div>
                </div>

                {/* 등록 폼 */}
                <RegistrationForm />

                {/* 푸터 */}
                <div className="text-center pb-8">
                    <p className="text-slate-500 text-xs">
                        입력하신 정보는 매칭 목적으로만 사용됩니다.
                    </p>
                </div>
            </div>
        </main>
    );
}
