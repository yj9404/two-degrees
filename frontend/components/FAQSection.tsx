"use client";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
    {
        question: "💡 매칭은 어떻게 진행되나요?",
        answer: (
            <div className="space-y-4 pt-2">
                <p>
                    TwoDegrees는 불필요한 감정 소모와 시간 낭비를 최소화하며 프라이버시를 철저히 보호합니다. 귀하의 프로필은 불특정 다수에게 절대 노출되지 않으며, 주선자가 직접 조건을 확인한 후 부합하는 상대에게만 제한적으로 전달됩니다.
                </p>
                <div className="space-y-2">
                    <p className="font-semibold text-slate-900 text-sm">Step 1. 프로필 및 사진 제안</p>
                    <p className="text-slate-500 text-sm">이름과 연락처를 제외한 상세 텍스트 프로필과 사진을 양측에 제안합니다.</p>
                </div>
                <div className="space-y-2">
                    <p className="font-semibold text-slate-900 text-sm">Step 2. 상호 수락 및 연락처 교환</p>
                    <p className="text-slate-500 text-sm">양측 모두 만남에 동의한 경우에만 실명과 연락처가 교환됩니다.</p>
                </div>
            </div>
        ),
    },
    {
        question: "💡 지인 추천이 왜 필수인가요?",
        answer: "신뢰할 수 있는 커뮤니티를 유지하기 위해 지인의 추천을 통해서만 가입이 가능합니다. 이는 허위 프로필을 방지하고 안전한 만남을 보장하기 위한 최소한의 장치입니다.",
    },
    {
        question: "💡 제 사진은 누구에게 공개되나요?",
        answer: "매칭 제안 시 어울리는 상대에게만 제한적으로 공개됩니다. 매칭이 종료되거나 거절할 경우, 상대방은 더 이상 귀하의 사진을 열람할 수 없습니다.",
    },
    {
        question: "💡 매칭 연락은 언제 오나요?",
        answer: "적합한 상대방을 찾으면 주선자가 직접 연락을 드립니다. 주로 평일 저녁(18:00~22:00) 또는 주말에 이루어집니다.",
    },
];

export default function FAQSection() {
    return (
        <Accordion type="single" collapsible className="w-full space-y-2">
            {FAQS.map((faq, index) => (
                <AccordionItem
                    key={index}
                    value={`item-${index}`}
                    className="bg-white rounded-lg border border-slate-200 px-4"
                >
                    <AccordionTrigger className="text-slate-900 font-semibold text-sm hover:no-underline py-4 text-left">
                        {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600 text-sm leading-relaxed pb-4">
                        {faq.answer}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}
