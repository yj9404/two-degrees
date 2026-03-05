"use client";

import { useState } from "react";
import { registerUser } from "@/lib/api";
import type { UserCreatePayload, Gender, SmokingStatus } from "@/types/user";

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
// 초기 폼 상태
// ────────────────────────────────────────────────────────────────
const INITIAL_FORM: Partial<UserCreatePayload> = {
    name: "",
    gender: undefined,
    birth_year: undefined,
    job: "",
    contact: "",
    password: "",
    referrer_name: "",
    desired_conditions: "",
    deal_breakers: "",
    instagram_id: "",
    height: undefined,
    active_area: "",
    education: "",
    workplace: "",
    mbti: "",
    smoking_status: undefined,
    religion: "",
    photo_urls: [],
};

// ────────────────────────────────────────────────────────────────
// 헬퍼: 섹션 헤더
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
export default function RegistrationForm() {
    const [form, setForm] = useState<Partial<UserCreatePayload>>(INITIAL_FORM);
    const [status, setStatus] = useState<
        "idle" | "loading" | "success" | "error"
    >("idle");
    const [errorMsg, setErrorMsg] = useState("");

    // 텍스트·숫자 입력 공통 핸들러
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === "number" ? (value === "" ? undefined : Number(value)) : value,
        }));
    };

    // Select / RadioGroup 공통 핸들러
    const handleSelect = (name: keyof UserCreatePayload, value: string) => {
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("loading");
        setErrorMsg("");

        try {
            await registerUser(form as UserCreatePayload);
            setStatus("success");
        } catch (err) {
            setStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
        }
    };

    // ── 등록 완료 화면 ────────────────────────────────────────────
    if (status === "success") {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <div className="text-5xl">🎉</div>
                <h2 className="text-slate-900 font-semibold text-xl">등록 완료!</h2>
                <p className="text-slate-500 text-sm">
                    소개팅 풀에 등록되었습니다.
                    <br />
                    매칭 연락을 기다려 주세요.
                </p>
                <Button
                    variant="outline"
                    onClick={() => {
                        setForm(INITIAL_FORM);
                        setStatus("idle");
                    }}
                >
                    다시 등록하기
                </Button>
                <a
                    href="/auth"
                    className="text-blue-600 text-sm font-semibold hover:underline"
                >
                    나중에 프로필 수정하기 →
                </a>
            </div>
        );
    }

    // ── 등록 폼 ──────────────────────────────────────────────────
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* ① 기본 정보 */}
            <SectionCard
                title="🧑 기본 정보"
                description="정확한 정보를 입력해 주세요. 허위 정보는 등록이 취소됩니다."
            >
                {/* 이름 */}
                <Field label="이름" required>
                    <Input
                        id="name"
                        name="name"
                        value={form.name ?? ""}
                        onChange={handleChange}
                        required
                    />
                </Field>

                {/* 성별 */}
                <Field label="성별" required>
                    <RadioGroup
                        value={form.gender ?? ""}
                        onValueChange={(v) => handleSelect("gender", v)}
                        className="flex gap-8"
                        required
                    >
                        <div className="flex items-center gap-2">
                            <RadioGroupItem value="MALE" id="gender-male" />
                            <Label htmlFor="gender-male" className="font-normal cursor-pointer">남성</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <RadioGroupItem value="FEMALE" id="gender-female" />
                            <Label htmlFor="gender-female" className="font-normal cursor-pointer">여성</Label>
                        </div>
                    </RadioGroup>
                </Field>

                {/* 출생연도 */}
                <Field label="출생연도" required>
                    <Input
                        id="birth_year"
                        name="birth_year"
                        type="number"
                        min={1980}
                        max={2008}
                        value={form.birth_year ?? ""}
                        onChange={handleChange}
                        required
                    />
                </Field>

                {/* 직업 */}
                <Field label="직업" required>
                    <Input
                        id="job"
                        name="job"
                        value={form.job ?? ""}
                        onChange={handleChange}
                        required
                    />
                </Field>

                {/* 연락처 */}
                <Field label="연락처" required hint="전화번호 또는 카카오톡 ID">
                    <Input
                        id="contact"
                        name="contact"
                        placeholder="010-0000-0000"
                        value={form.contact ?? ""}
                        onChange={handleChange}
                        required
                    />
                </Field>

                {/* 정보 수정용 비밀번호 */}
                <Field
                    label="정보 수정용 비밀번호"
                    required
                    hint="나중에 프로필을 수정하거나 매칭 노출 여부를 변경할 때 사용합니다. (4자 이상)"
                >
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="비밀번호를 입력해 주세요"
                        value={form.password ?? ""}
                        onChange={handleChange}
                        required
                        minLength={4}
                    />
                </Field>

                {/* 초대한 지인 */}
                <Field label="소개해 준 지인 이름" required hint="신원 보증용. 실명을 입력해 주세요.">
                    <Input
                        id="referrer_name"
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
                        id="desired_conditions"
                        name="desired_conditions"
                        placeholder="예) 유머 감각이 있고 대화가 잘 통하는 분, 가족을 소중히 여기는 분... (최소 10자)"
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
                        id="deal_breakers"
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
                {/* 키 */}
                <Field label="키 (cm)">
                    <Input
                        id="height"
                        name="height"
                        type="number"
                        min={140}
                        max={220}
                        value={form.height ?? ""}
                        onChange={handleChange}
                    />
                </Field>

                {/* 주 활동 지역 */}
                <Field label="주 활동 지역">
                    <Input
                        id="active_area"
                        name="active_area"
                        placeholder="예: 서울 강남"
                        value={form.active_area ?? ""}
                        onChange={handleChange}
                    />
                </Field>

                {/* 학력 */}
                <Field label="학력">
                    <Input
                        id="education"
                        name="education"
                        placeholder="예: ○○대학교"
                        value={form.education ?? ""}
                        onChange={handleChange}
                    />
                </Field>

                {/* 직장 위치 */}
                <Field label="직장 위치">
                    <Input
                        id="workplace"
                        name="workplace"
                        placeholder="예: 판교, 여의도"
                        value={form.workplace ?? ""}
                        onChange={handleChange}
                    />
                </Field>

                {/* MBTI */}
                <Field label="MBTI">
                    <Input
                        id="mbti"
                        name="mbti"
                        placeholder="예: ENFP"
                        value={form.mbti ?? ""}
                        onChange={handleChange}
                        maxLength={4}
                    />
                </Field>

                {/* 흡연 여부 */}
                <Field label="흡연 여부">
                    <Select
                        value={form.smoking_status ?? ""}
                        onValueChange={(v) => handleSelect("smoking_status", v as SmokingStatus)}
                    >
                        <SelectTrigger id="smoking_status">
                            <SelectValue placeholder="선택해 주세요" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="NON_SMOKER">비흡연</SelectItem>
                            <SelectItem value="SMOKER">흡연</SelectItem>
                        </SelectContent>
                    </Select>
                </Field>

                {/* 종교 */}
                <Field label="종교">
                    <Input
                        id="religion"
                        name="religion"
                        placeholder="예: 무교, 기독교, 불교"
                        value={form.religion ?? ""}
                        onChange={handleChange}
                    />
                </Field>

                {/* 인스타그램 아이디 */}
                <Field label="인스타그램 아이디" hint="본인 확인 및 매칭 참고용으로 사용됩니다.">
                    <Input
                        id="instagram_id"
                        name="instagram_id"
                        type="text"
                        placeholder="예: hello_world"
                        value={form.instagram_id ?? ""}
                        onChange={handleChange}
                    />
                </Field>

                {/* 프로필 사진 */}
                <Field label="프로필 사진" hint="철저한 신원 확인을 위해 실제 사진을 등록해 주세요. (S3 환경변수 설정 후 활성화)">
                    <ImageUploader
                        value={form.photo_urls ?? []}
                        onChange={(urls) => setForm((prev) => ({ ...prev, photo_urls: urls }))}
                    />
                </Field>
            </SectionCard>

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
                {status === "loading" ? "등록 중..." : "소개팅 풀 등록하기"}
            </Button>
        </form>
    );
}
