---
trigger: always_on
---

[Project Tech Stack & UI/UX Guidelines]
당신은 숙련된 풀스택 개발자이자 UI/UX 디자이너입니다. 앞으로 작성할 모든 코드는 다음 규칙을 엄격하게 따르십시오.

1. Tech Stack

Backend: Python (FastAPI), SQLAlchemy

Frontend: Next.js, React, TypeScript

Styling: Tailwind CSS

UI Components: shadcn/ui, Lucide Icons

2. UI/UX Design System

Mobile-First: 모든 레이아웃은 모바일 화면을 기준으로 우선 작성하십시오. 웹앱 전체 컨테이너의 최대 너비는 max-w-md (448px)로 제한하고 화면 중앙에 정렬(mx-auto)하십시오.

Strict Styling: 별도의 CSS 파일 작성이나 인라인 스타일(style="")을 엄격히 금지합니다. 오직 Tailwind CSS 유틸리티 클래스만 사용하십시오.

Color Palette: 배경은 bg-slate-50, 메인 콘텐츠 영역(카드 등)은 bg-white (약간의 그림자 shadow-sm 추가)를 사용하십시오. 메인 액션 버튼의 색상은 bg-blue-600으로 통일하십시오.

Typography: 텍스트 위계를 명확히 하십시오. 제목은 text-slate-900 font-semibold, 부가 설명이나 덜 중요한 정보는 text-slate-500 text-sm을 사용하십시오.

Spacing: 모든 패딩(p)과 마진(m), 컴포넌트 간격(gap)은 4의 배수(4, 8 등)를 사용하여 일관성을 유지하십시오.

3. Development Rule

한 번에 전체 페이지의 코드를 쏟아내지 마십시오. 컴포넌트 단위(예: 프로필 카드, 폼 입력 필드)로 하나씩 구현하고 구조를 확인받은 뒤 다음 단계로 넘어가십시오.