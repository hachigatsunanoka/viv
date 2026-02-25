import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useConfig } from '../../hooks/useConfig';
import { GoogleGenAI } from '@google/genai';
import { Loader2 } from 'lucide-react';
import './NanoBananaDialog.css';

interface NanoBananaDialogProps {
	nodeId: string;
	onClose: () => void;
	onGenerate: (dataUrl: string) => void;
}

export const NanoBananaDialog: React.FC<NanoBananaDialogProps> = ({ nodeId, onClose, onGenerate }) => {
	const node = useStore((state) => state.nodes.find((n) => n.id === nodeId));
	const [prompt, setPrompt] = useState('');
	const { nanoBananaApiKey } = useConfig();
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	useEffect(() => {
		if (node && node.type === 'image') {
			setPreviewUrl(node.content);
		}
	}, [node]);

	const apiKeyToUse = import.meta.env.VITE_GOOGLE_API_KEY || nanoBananaApiKey;

	const handleGenerate = async () => {
		if (!apiKeyToUse) {
			setError('API Key is required');
			return;
		}
		if (!prompt) {
			setError('Prompt is required');
			return;
		}
		if (!node || !node.content) {
			setError('Source image not found');
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			// Convert node.content (URL/Blob URL) to base64
			const response = await fetch(node.content);
			const blob = await response.blob();
			const base64 = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onloadend = () => {
					const result = reader.result as string;
					const base64Data = result.split(',')[1];
					resolve(base64Data);
				};
				reader.onerror = reject;
				reader.readAsDataURL(blob);
			});

			const client = new GoogleGenAI({ apiKey: apiKeyToUse });

			// Use client.models.generateContent for @google/genai SDK
			const result = await client.models.generateContent({
				model: 'gemini-2.5-flash-image',
				contents: [
					{
						parts: [
							{ text: prompt },
							{
								inlineData: {
									mimeType: blob.type,
									data: base64
								}
							}
						]
					}
				],
				config: {
					responseModalities: ['IMAGE']
				}
			});

			// Extract image from response
			// Check candidates -> content -> parts -> inlineData
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const generatedPart = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

			if (generatedPart && generatedPart.inlineData && generatedPart.inlineData.data) {
				const generatedBase64 = generatedPart.inlineData.data;
				const mimeType = generatedPart.inlineData.mimeType || 'image/png';
				const dataUrl = `data:${mimeType};base64,${generatedBase64}`;

				onGenerate(dataUrl);
				onClose();
			} else {
				throw new Error('No image generated in response');
			}

		} catch (err: unknown) {
			console.error('Gemini Generation Error:', err);
			const errorMessage = err instanceof Error ? err.message : 'Failed to generate image';
			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	if (!node) return null;

	return (
		<div
			className="nano-banana-overlay"
			onMouseDown={(e) => e.stopPropagation()}
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(e) => e.stopPropagation()}
			onKeyUp={(e) => e.stopPropagation()}
		>
			<div className="nano-banana-dialog">
				<div className="dialog-header">
					<h3>Nano Banana</h3>
				</div>

				<div className="dialog-content">
					<div className="source-preview">
						{previewUrl && <img src={previewUrl} alt="Source" />}
					</div>

					<div className="input-group">
						<label>Prompt</label>
						<textarea
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							placeholder="Describe how to modify the image..."
							rows={4}
						/>
					</div>

					{!apiKeyToUse && (
						<div className="error-message">API key not set. Configure it in Settings → Plugin → Nano Banana.</div>
					)}

					{error && <div className="error-message">{error}</div>}
				</div>

				<div className="dialog-footer">
					<button
						className="generate-button"
						onClick={handleGenerate}
						disabled={isLoading || !prompt || !apiKeyToUse}
					>
						{isLoading ? (
							<>
								<Loader2 className="spinner" size={16} />
								Generating...
							</>
						) : (
							'Generate'
						)}
					</button>
					<button className="cancel-button" onClick={onClose}>Cancel</button>
				</div>
			</div>
		</div>
	);
};
