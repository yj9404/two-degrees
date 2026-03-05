"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authenticateUser } from "@/lib/api";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function AuthPage() {
    const router = useRouter();
    const [contact, setContact] = useState("");
    const [password, setPassword] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("loading");
        setErrorMsg("");

        try {
            const { user_id } = await authenticateUser({ contact, password });
            // 인증 성공 → 프로필 수정 페이지로 이동 (user_id를 URL에 포함)
            router.push(`/edit/${user_id}`);
        } catch (err) {
            setStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
        }
    };

    return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md space-y-6">
                {/* 헤더 */}
                <div className="text-center space-y-1">
                    <h1 className="text-slate-900 font-semibold text-2xl tracking-tight">
                        TwoDegrees 💑
                    </h1>
                    <p className="text-slate-500 text-sm">
                        본인 확인 후 프로필을 수정할 수 있습니다
                    </p>
                </div>

                {/* 로그인 카드 */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-slate-900 font-semibold text-base">
                            🔒 본인 인증
                        </CardTitle>
                        <CardDescription className="text-slate-500 text-sm">
                            등록 시 입력한 연락처와 비밀번호를 입력해 주세요.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* 연락처 */}
                            <div className="space-y-1">
                                <Label
                                    htmlFor="contact"
                                    className="text-slate-900 font-semibold text-sm"
                                >
                                    연락처
                                    <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <Input
                                    id="contact"
                                    type="text"
                                    placeholder="010-0000-0000 또는 카카오톡 ID"
                                    value={contact}
                                    onChange={(e) => setContact(e.target.value)}
                                    required
                                />
                            </div>

                            {/* 비밀번호 */}
                            <div className="space-y-1">
                                <Label
                                    htmlFor="auth-password"
                                    className="text-slate-900 font-semibold text-sm"
                                >
                                    비밀번호
                                    <span className="text-red-500 ml-0.5">*</span>
                                </Label>
                                <Input
                                    id="auth-password"
                                    type="password"
                                    placeholder="등록 시 설정한 비밀번호"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            {/* 에러 메시지 */}
                            {status === "error" && (
                                <p className="text-red-500 text-sm text-center">{errorMsg}</p>
                            )}

                            {/* 제출 버튼 */}
                            <Button
                                type="submit"
                                disabled={status === "loading"}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 text-base"
                            >
                                {status === "loading" ? "확인 중..." : "본인 인증하기"}
                            </Button>

                            {/* 등록 페이지 링크 */}
                            <p className="text-center text-slate-500 text-sm">
                                아직 등록하지 않으셨나요?{" "}
                                <a
                                    href="/"
                                    className="text-blue-600 font-semibold hover:underline"
                                >
                                    소개팅 풀 등록하기
                                </a>
                            </p>
                        </form>
                    </CardContent>
                </Card>

                <p className="text-center text-slate-500 text-xs">
                    입력하신 정보는 매칭 목적으로만 사용됩니다.
                </p>
            </div>
        </main>
    );
}
