"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getUser, updateUser } from "@/lib/api";
import type { UserUpdatePayload, Gender, SmokingStatus } from "@/types/user";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ImageUploader from "@/components/ImageUploader";

// ────────────────────────────────────────────────────────────────
// 헬퍼: 섹션 카드
// ────────────────────────────────────────────────────────────────
function SectionCard({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
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

// ────────────────────────────────────────────────────────────────
// 헬퍼: 필드 래퍼
// ────────────────────────────────────────────────────────────────
function Field({
    label,
    required,
    children,
    hint,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
    hint?: string;
}) {
    return (
        <div className="space-y-1">
            <Label className="text-slate-900 font-semibold text-sm">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            {children}
            {hint && <p className="text-slate-500 text-xs">{hint}</p>}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────────
export default function EditProfilePage() {
    const { user_id } = useParams<{ user_id: string }>();
    const router = useRouter();

    const [form, setForm] = useState<UserUpdatePayload>({});
    const [isActive, setIsActive] = useState(true);
    const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
        "loading"
    );
    const [saveStatus, setSaveStatus] = useState<
        "idle" | "loading" | "success" | "error"
    >("idle");
    const [errorMsg, setErrorMsg] = useState("");

    // ── 기존 데이터 불러오기 (pre-fill) ──────────────────────────
    useEffect(() => {
        if (!user_id) return;
        getUser(user_id)
            .then((user) => {
                setForm({
                    name: user.name,
                    gender: user.gender,
                    birth_year: user.birth_year,
                    job: user.job,
                    referrer_name: user.referrer_name,
                    desired_conditions: user.desired_conditions,
                    deal_breakers: user.deal_breakers,
                    instagram_id: user.instagram_id ?? "",
                    photo_urls: user.photo_urls ?? [],
                    height: user.height ?? undefined,
                    active_area: user.active_area ?? "",
                    education: user.education ?? "",
                    workplace: user.workplace ?? "",
                    mbti: user.mbti ?? "",
                    smoking_status: user.smoking_status ?? undefined,
                    religion: user.religion ?? "",
                });
                setIsActive(user.is_active);
                setLoadStatus("ready");
            })
            .catch(() => setLoadStatus("error"));
    }, [user_id]);

    // ── 핸들러 ────────────────────────────────────────────────────
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]:
                type === "number" ? (value === "" ? undefined : Number(value)) : value,
        }));
    };

    const handleSelect = (name: keyof UserUpdatePayload, value: string) => {
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaveStatus("loading");
        setErrorMsg("");

        try {
            await updateUser(user_id, { ...form, is_active: isActive });
            setSaveStatus("success");
        } catch (err) {
            setSaveStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
        }
    };

    // ── 로딩/에러 상태 ────────────────────────────────────────────
    if (loadStatus === "loading") {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center">
                <p className="text-slate-500 text-sm">프로필 불러오는 중...</p>
            </main>
        );
    }

    if (loadStatus === "error") {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="text-center space-y-4">
                    <p className="text-slate-900 font-semibold">
                        프로필을 불러올 수 없습니다.
                    </p>
                    <Button variant="outline" onClick={() => router.push("/auth")}>
                        다시 인증하기
                    </Button>
                </div>
            </main>
        );
    }

    // ── 저장 완료 화면 ────────────────────────────────────────────
    if (saveStatus === "success") {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="flex flex-col items-center gap-4 py-16 text-center">
                    <div className="text-5xl">✅</div>
                    <h2 className="text-slate-900 font-semibold text-xl">수정 완료!</h2>
                    <p className="text-slate-500 text-sm">
                        프로필이 성공적으로 업데이트되었습니다.
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => setSaveStatus("idle")}
                    >
                        계속 수정하기
                    </Button>
                </div>
            </main>
        );
    }

    // ── 수정 폼 ──────────────────────────────────────────────────
    return (
        <main className="min-h-screen bg-slate-50 py-8 px-4">
            <div className="max-w-md mx-auto space-y-6">
                {/* 헤더 */}
                <div className="text-center space-y-1">
                    <h1 className="text-slate-900 font-semibold text-2xl tracking-tight">
                        TwoDegrees 💑
                    </h1>
                    <p className="text-slate-500 text-sm">내 프로필 수정</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* ── 매칭 풀 노출 토글 ── */}
                    <Card className="shadow-sm border-2 border-blue-100 bg-blue-50/50">
                        <CardContent className="pt-6 pb-6">
                            <div className="flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-slate-900 font-semibold text-sm">
                                        매칭 풀에 내 프로필 노출하기
                                    </p>
                                    <p className="text-slate-500 text-xs">
                                        {isActive
                                            ? "✅ 현재 매칭 풀에 노출 중입니다."
                                            : "⏸️ 현재 매칭 풀에서 숨겨져 있습니다."}
                                    </p>
                                </div>
                                <Switch
                                    id="is-active-toggle"
                                    checked={isActive}
                                    onCheckedChange={setIsActive}
                                    className="data-[state=checked]:bg-blue-600"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* ① 기본 정보 */}
                    <SectionCard
                        title="🧑 기본 정보"
                        description="변경할 정보를 수정해 주세요."
                    >
                        <Field label="이름" required>
                            <Input
                                id="edit-name"
                                name="name"
                                placeholder="홍길동"
                                value={form.name ?? ""}
                                onChange={handleChange}
                                required
                            />
                        </Field>

                        <Field label="성별" required>
                            <RadioGroup
                                value={form.gender ?? ""}
                                onValueChange={(v) => handleSelect("gender", v)}
                                className="flex gap-8"
                            >
                                <div className="flex items-center gap-2">
                                    <RadioGroupItem value="MALE" id="edit-gender-male" />
                                    <Label
                                        htmlFor="edit-gender-male"
                                        className="font-normal cursor-pointer"
                                    >
                                        남성
                                    </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <RadioGroupItem value="FEMALE" id="edit-gender-female" />
                                    <Label
                                        htmlFor="edit-gender-female"
                                        className="font-normal cursor-pointer"
                                    >
                                        여성
                                    </Label>
                                </div>
                            </RadioGroup>
                        </Field>

                        <Field label="출생연도" required>
                            <Input
                                id="edit-birth_year"
                                name="birth_year"
                                type="number"
                                min={1980}
                                max={2008}
                                value={form.birth_year ?? ""}
                                onChange={handleChange}
                                required
                            />
                        </Field>

                        <Field label="직업" required>
                            <Input
                                id="edit-job"
                                name="job"
                                value={form.job ?? ""}
                                onChange={handleChange}
                                required
                            />
                        </Field>

                        <Field label="소개해 준 지인 이름" required hint="신원 보증용. 실명을 입력해 주세요.">
                            <Input
                                id="edit-referrer_name"
                                name="referrer_name"
                                value={form.referrer_name ?? ""}
                                onChange={handleChange}
                                required
                            />
                        </Field>
                    </SectionCard>

                    {/* ② 상대방 조건 */}
                    <SectionCard
                        title="💌 상대방 조건"
                        description="원하는 상대방의 조건을 자유롭게 작성해 주세요."
                    >
                        <Field label="원하는 상대방 조건" required>
                            <Textarea
                                id="edit-desired_conditions"
                                name="desired_conditions"
                                placeholder="예) 유머 감각이 있고 대화가 잘 통하는 분... (최소 10자)"
                                rows={4}
                                value={form.desired_conditions ?? ""}
                                onChange={handleChange}
                                required
                                minLength={10}
                                className="resize-none"
                            />
                        </Field>

                        <Field label="절대 기피하는 조건" required>
                            <Textarea
                                id="edit-deal_breakers"
                                name="deal_breakers"
                                placeholder="예) 흡연자, 종교 강요, 매너 없는 분... (최소 10자)"
                                rows={3}
                                value={form.deal_breakers ?? ""}
                                onChange={handleChange}
                                required
                                minLength={10}
                                className="resize-none"
                            />
                        </Field>
                    </SectionCard>

                    {/* ③ 선택 정보 */}
                    <SectionCard
                        title="📋 선택 정보"
                        description="작성할수록 더 정확한 매칭이 가능합니다. (모두 선택 사항)"
                    >
                        <Field label="키 (cm)">
                            <Input
                                id="edit-height"
                                name="height"
                                type="number"
                                min={140}
                                max={220}
                                value={form.height ?? ""}
                                onChange={handleChange}
                            />
                        </Field>

                        <Field label="주 활동 지역">
                            <Input
                                id="edit-active_area"
                                name="active_area"
                                placeholder="예: 서울 강남"
                                value={form.active_area ?? ""}
                                onChange={handleChange}
                            />
                        </Field>

                        <Field label="학력">
                            <Input
                                id="edit-education"
                                name="education"
                                placeholder="예: ○○대학교"
                                value={form.education ?? ""}
                                onChange={handleChange}
                            />
                        </Field>

                        <Field label="직장 위치">
                            <Input
                                id="edit-workplace"
                                name="workplace"
                                placeholder="예: 판교, 여의도"
                                value={form.workplace ?? ""}
                                onChange={handleChange}
                            />
                        </Field>

                        <Field label="MBTI">
                            <Input
                                id="edit-mbti"
                                name="mbti"
                                placeholder="예: ENFP"
                                value={form.mbti ?? ""}
                                onChange={handleChange}
                                maxLength={4}
                            />
                        </Field>

                        <Field label="흡연 여부">
                            <Select
                                value={form.smoking_status ?? ""}
                                onValueChange={(v) =>
                                    handleSelect("smoking_status", v as SmokingStatus)
                                }
                            >
                                <SelectTrigger id="edit-smoking_status">
                                    <SelectValue placeholder="선택해 주세요" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NON_SMOKER">비흡연</SelectItem>
                                    <SelectItem value="SMOKER">흡연</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>

                        <Field label="종교">
                            <Input
                                id="edit-religion"
                                name="religion"
                                placeholder="예: 무교, 기독교, 불교"
                                value={form.religion ?? ""}
                                onChange={handleChange}
                            />
                        </Field>

                        <Field
                            label="인스타그램 아이디"
                            hint="본인 확인 및 매칭 참고용으로 사용됩니다."
                        >
                            <Input
                                id="edit-instagram_id"
                                name="instagram_id"
                                type="text"
                                placeholder="예: hello_world"
                                value={form.instagram_id ?? ""}
                                onChange={handleChange}
                            />
                        </Field>

                        {/* 프로필 사진 */}
                        <Field
                            label="프로필 사진"
                            hint="철저한 신원 확인을 위해 실제 사진을 등록해 주세요."
                        >
                            <ImageUploader
                                value={form.photo_urls ?? []}
                                onChange={(urls) => setForm((prev) => ({ ...prev, photo_urls: urls }))}
                            />
                        </Field>
                    </SectionCard>

                    {/* 에러 메시지 */}
                    {saveStatus === "error" && (
                        <p className="text-red-500 text-sm text-center">{errorMsg}</p>
                    )}

                    {/* 저장 버튼 */}
                    <Button
                        type="submit"
                        disabled={saveStatus === "loading"}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 text-base"
                    >
                        {saveStatus === "loading" ? "저장 중..." : "프로필 저장하기"}
                    </Button>

                    {/* 뒤로가기 */}
                    <Button
                        type="button"
                        variant="ghost"
                        className="w-full text-slate-500"
                        onClick={() => router.push("/auth")}
                    >
                        ← 인증 페이지로 돌아가기
                    </Button>
                </form>

                <p className="text-center text-slate-500 text-xs pb-8">
                    입력하신 정보는 매칭 목적으로만 사용됩니다.
                </p>
            </div>
        </main>
    );
}
