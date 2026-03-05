"use client";

/**
 * ImageUploader.tsx
 * S3 Presigned URL 방식으로 이미지를 업로드하는 재사용 가능한 컴포넌트.
 * - 최대 maxPhotos(기본 10)장 업로드 지원
 * - 드래그&드롭 또는 파일 선택 UI
 * - 업로드 중 로딩 스피너 및 썸네일 미리보기
 */

import { useRef, useState } from "react";
import { uploadImageToS3 } from "@/lib/api";
import { Button } from "@/components/ui/button";

const ACCEPTED = "image/jpeg,image/png,image/webp";
const MAX_PHOTOS = 10;

interface Props {
    /** 현재 저장된 이미지 URL 목록 */
    value: string[];
    /** 목록이 변경될 때마다 호출 */
    onChange: (urls: string[]) => void;
    /** 최대 업로드 장수 (기본 10) */
    maxPhotos?: number;
}

export default function ImageUploader({
    value,
    onChange,
    maxPhotos = MAX_PHOTOS,
}: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploadingCount, setUploadingCount] = useState(0);
    const [error, setError] = useState("");

    const remaining = maxPhotos - value.length;

    async function handleFiles(files: FileList | null) {
        if (!files || files.length === 0) return;
        setError("");

        const toUpload = Array.from(files).slice(0, remaining);
        if (toUpload.length < files.length) {
            setError(`최대 ${maxPhotos}장까지 업로드할 수 있습니다.`);
        }
        if (toUpload.length === 0) return;

        setUploadingCount(toUpload.length);
        const results: string[] = [];

        for (const file of toUpload) {
            try {
                const url = await uploadImageToS3(file);
                results.push(url);
            } catch (e) {
                setError(e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다.");
            } finally {
                setUploadingCount((c) => c - 1);
            }
        }

        if (results.length > 0) {
            onChange([...value, ...results]);
        }
    }

    function removePhoto(idx: number) {
        const next = [...value];
        next.splice(idx, 1);
        onChange(next);
    }

    return (
        <div className="space-y-3">
            {/* 미리보기 그리드 */}
            {value.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                    {value.map((url, idx) => (
                        <div
                            key={url}
                            className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 group"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={url}
                                alt={`사진 ${idx + 1}`}
                                className="w-full h-full object-cover"
                            />
                            {/* 삭제 버튼 */}
                            <button
                                type="button"
                                onClick={() => removePhoto(idx)}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="사진 삭제"
                            >
                                ✕
                            </button>
                            {/* 대표 사진 뱃지 */}
                            {idx === 0 && (
                                <span className="absolute bottom-1 left-1 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">
                                    대표
                                </span>
                            )}
                        </div>
                    ))}

                    {/* 업로드 중 플레이스홀더 */}
                    {Array.from({ length: uploadingCount }).map((_, i) => (
                        <div
                            key={`uploading-${i}`}
                            className="aspect-square rounded-lg bg-slate-100 flex items-center justify-center animate-pulse"
                        >
                            <span className="text-slate-400 text-xs">업로드 중…</span>
                        </div>
                    ))}
                </div>
            )}

            {/* 업로드 버튼 (최대 장수 미달일 때만 노출) */}
            {remaining > 0 && (
                <>
                    <input
                        ref={inputRef}
                        type="file"
                        accept={ACCEPTED}
                        multiple
                        className="hidden"
                        onChange={(e) => handleFiles(e.target.files)}
                        // 같은 파일을 재선택할 수 있도록 value 초기화
                        onClick={(e) => {
                            (e.target as HTMLInputElement).value = "";
                        }}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full border-dashed text-slate-500 hover:text-slate-700"
                        disabled={uploadingCount > 0}
                        onClick={() => inputRef.current?.click()}
                    >
                        {uploadingCount > 0
                            ? `업로드 중 (${uploadingCount}장 남음)…`
                            : `📷 사진 추가 (${value.length}/${maxPhotos}장)`}
                    </Button>
                </>
            )}

            {/* 에러 */}
            {error && (
                <p className="text-red-500 text-xs">{error}</p>
            )}

            {/* 안내 문구 */}
            <p className="text-slate-400 text-xs">
                JPG · PNG · WebP 형식, 최대 {maxPhotos}장 · 첫 번째 사진이 대표 사진으로 표시됩니다.
            </p>
        </div>
    );
}
