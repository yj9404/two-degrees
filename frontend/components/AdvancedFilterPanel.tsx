"use client";

import React, { useState } from "react";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter,
} from "@/components/ui/sheet";

// ── 타입 정의 ────────────────────────────────────────────────────────────────

export interface AdvancedFilterValues {
    gender?: string;
    ref_age?: number;
    mbti_includes?: string;   // 쉼표로 구분된 문자열 e.g. "E,N,F"
    religion?: string;
    smoking_status?: string;
    drinking_status?: string;
    min_height?: number;
    max_height?: number;
    child_plan?: string;
    marriage_intent?: string;
}

interface Props {
    onApply: (filters: AdvancedFilterValues) => void;
    activeCount: number; // 현재 적용된 필터 수 (뱃지 표시용)
}

// ── 상수 ─────────────────────────────────────────────────────────────────────

const MBTI_LETTERS = ["E", "I", "S", "N", "F", "T", "J", "P"] as const;

const RELIGION_OPTIONS = [
    { value: "무교", label: "무교" },
    { value: "기독교", label: "기독교" },
    { value: "불교", label: "불교" },
    { value: "천주교", label: "천주교" },
    { value: "그외", label: "그 외" },
];

const SMOKING_OPTIONS = [
    { value: "NON_SMOKER", label: "비흡연자" },
    { value: "SMOKER", label: "흡연자" },
];

const DRINKING_OPTIONS = [
    { value: "NON_DRINKER", label: "비음주" },
    { value: "SOCIAL_DRINKER", label: "가끔 (회식 등)" },
    { value: "DRINKER", label: "음주" },
];

const CHILD_PLAN_OPTIONS = [
    { value: "WANT", label: "WANT — 반드시 원함" },
    { value: "OPEN", label: "OPEN — 좋은 분이면" },
    { value: "NOT_NOW", label: "NOT_NOW — 아직 생각 없음" },
    { value: "DINK", label: "DINK — 원치 않음" },
];

const MARRIAGE_INTENT_OPTIONS = [
    { value: "WILLING", label: "WILLING — 생각 있음" },
    { value: "OPEN", label: "OPEN — 좋은 분이면" },
    { value: "NOT_NOW", label: "NOT_NOW — 아직 생각 없음" },
    { value: "NON_MARRIAGE", label: "NON_MARRIAGE — 비혼" },
];

// ── 내부 상태 초기값 ──────────────────────────────────────────────────────────

const INITIAL_STATE = {
    gender: "",
    ref_age: "",
    mbtiLetters: [] as string[],
    religion: "",
    smoking_status: "",
    drinking_status: "",
    min_height: "",
    max_height: "",
    child_plan: "",
    marriage_intent: "",
};

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default function AdvancedFilterPanel({ onApply, activeCount }: Props) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(INITIAL_STATE);

    const set = (key: keyof typeof INITIAL_STATE, value: string) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const toggleMbti = (letter: string) => {
        setForm((prev) => ({
            ...prev,
            mbtiLetters: prev.mbtiLetters.includes(letter)
                ? prev.mbtiLetters.filter((l) => l !== letter)
                : [...prev.mbtiLetters, letter],
        }));
    };

    const handleReset = () => setForm(INITIAL_STATE);

    const handleApply = () => {
        // 빈 값 제거 후 부모에 전달
        const filters: AdvancedFilterValues = {};

        if (form.gender) filters.gender = form.gender;
        const ageNum = parseInt(form.ref_age, 10);
        if (!isNaN(ageNum) && ageNum > 0) filters.ref_age = ageNum;
        if (form.mbtiLetters.length > 0) filters.mbti_includes = form.mbtiLetters.join(",");
        if (form.religion) filters.religion = form.religion;
        if (form.smoking_status) filters.smoking_status = form.smoking_status;
        if (form.drinking_status) filters.drinking_status = form.drinking_status;
        const minH = parseInt(form.min_height, 10);
        const maxH = parseInt(form.max_height, 10);
        if (!isNaN(minH) && minH > 0) filters.min_height = minH;
        if (!isNaN(maxH) && maxH > 0) filters.max_height = maxH;
        if (form.child_plan) filters.child_plan = form.child_plan;
        if (form.marriage_intent) filters.marriage_intent = form.marriage_intent;

        onApply(filters);
        setOpen(false);
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button size="sm" variant="outline" className="relative h-9 gap-1.5">
                    <SlidersHorizontal className="w-4 h-4" />
                    상세 조건
                    {activeCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-blue-600 text-white rounded-full">
                            {activeCount}
                        </span>
                    )}
                </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-[340px] sm:w-[400px] overflow-y-auto flex flex-col">
                <SheetHeader>
                    <SheetTitle>상세 조건 검색</SheetTitle>
                </SheetHeader>

                <div className="flex-1 space-y-6 py-4 pr-1">
                    {/* 성별 */}
                    <FilterSection label="성별">
                        <SelectField
                            value={form.gender}
                            onChange={(v) => set("gender", v)}
                            options={[
                                { value: "MALE", label: "남자" },
                                { value: "FEMALE", label: "여자" },
                            ]}
                            placeholder="전체"
                        />
                    </FilterSection>

                    {/* 선호 연령대 교차 검증 */}
                    <FilterSection
                        label="선호 연령대 교차 검증"
                        desc="이 나이를 선호하는 유저를 검색합니다 (상대방 희망 나이 범위 기준)"
                    >
                        <Input
                            type="number"
                            placeholder="예: 27"
                            min={18}
                            max={60}
                            value={form.ref_age}
                            onChange={(e) => set("ref_age", e.target.value)}
                            className="h-9 text-sm w-28"
                        />
                    </FilterSection>

                    {/* MBTI */}
                    <FilterSection label="MBTI 포함 (중복 선택)">
                        <div className="grid grid-cols-4 gap-2">
                            {MBTI_LETTERS.map((letter) => (
                                <label
                                    key={letter}
                                    className="flex items-center gap-1.5 cursor-pointer select-none"
                                >
                                    <Checkbox
                                        checked={form.mbtiLetters.includes(letter)}
                                        onCheckedChange={() => toggleMbti(letter)}
                                    />
                                    <span className="text-sm font-medium text-slate-700">{letter}</span>
                                </label>
                            ))}
                        </div>
                        {form.mbtiLetters.length > 0 && (
                            <p className="text-xs text-blue-600 mt-1">
                                선택: {form.mbtiLetters.join(", ")} 를 모두 포함하는 MBTI
                            </p>
                        )}
                    </FilterSection>

                    {/* 종교 */}
                    <FilterSection label="종교">
                        <SelectField
                            value={form.religion}
                            onChange={(v) => set("religion", v)}
                            options={RELIGION_OPTIONS}
                            placeholder="전체"
                        />
                    </FilterSection>

                    {/* 흡연 여부 */}
                    <FilterSection label="흡연 여부">
                        <SelectField
                            value={form.smoking_status}
                            onChange={(v) => set("smoking_status", v)}
                            options={SMOKING_OPTIONS}
                            placeholder="전체"
                        />
                    </FilterSection>

                    {/* 음주 여부 */}
                    <FilterSection label="음주 여부">
                        <SelectField
                            value={form.drinking_status}
                            onChange={(v) => set("drinking_status", v)}
                            options={DRINKING_OPTIONS}
                            placeholder="전체"
                        />
                    </FilterSection>

                    {/* 키 범위 */}
                    <FilterSection label="키 범위 (cm)">
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                placeholder="최소"
                                min={140}
                                max={220}
                                value={form.min_height}
                                onChange={(e) => set("min_height", e.target.value)}
                                className="h-9 text-sm w-24"
                            />
                            <span className="text-slate-400 text-sm">~</span>
                            <Input
                                type="number"
                                placeholder="최대"
                                min={140}
                                max={220}
                                value={form.max_height}
                                onChange={(e) => set("max_height", e.target.value)}
                                className="h-9 text-sm w-24"
                            />
                            <span className="text-slate-500 text-sm">cm</span>
                        </div>
                    </FilterSection>

                    {/* 자녀 계획 */}
                    <FilterSection label="자녀 계획">
                        <SelectField
                            value={form.child_plan}
                            onChange={(v) => set("child_plan", v)}
                            options={CHILD_PLAN_OPTIONS}
                            placeholder="전체"
                        />
                    </FilterSection>

                    {/* 결혼 의향 */}
                    <FilterSection label="결혼 의향">
                        <SelectField
                            value={form.marriage_intent}
                            onChange={(v) => set("marriage_intent", v)}
                            options={MARRIAGE_INTENT_OPTIONS}
                            placeholder="전체"
                        />
                    </FilterSection>
                </div>

                <SheetFooter className="border-t pt-4 gap-2 flex-row">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={handleReset}
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        초기화
                    </Button>
                    <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleApply}>
                        적용
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

function FilterSection({
    label,
    desc,
    children,
}: {
    label: string;
    desc?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">{label}</Label>
            {desc && <p className="text-[11px] text-slate-400 leading-snug">{desc}</p>}
            {children}
        </div>
    );
}

function SelectField({
    value,
    onChange,
    options,
    placeholder,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
            <option value="">{placeholder}</option>
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}
