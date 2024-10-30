async function recognize(base64, lang, options) {
    const { config, utils } = options;
    const { tauriFetch: fetch } = utils;
    let { model = "gpt-4o", apiKey, requestPath, customPrompt } = config;

    // 处理 requestPath
    const url = new URL(requestPath || "https://api.openai.com/v1/chat/completions");
    if (!url.pathname.endsWith('/chat/completions')) {
        url.pathname = '/v1/chat/completions';
    }

    // 设置 customPrompt
    if (!customPrompt) {
        customPrompt = 'You are an advanced OCR system. Extract all text from the image, maintaining original formatting and layout. Observe details like font, size, color, and alignment. Perceive the image as a human would.\nKey points:\n\n1. Output only extracted text, no explanations.\n2. Preserve original format (paragraphs, indents, alignment).\n3. Identify special characters, numbers, symbols.\n4. Recreate table structures if present.\n5. Maintain original capitalization and punctuation.\n6. Retain text color information if possible.\n7. Distinguish between body text, headings, footnotes, etc.\nAnalyze the image and output all text in its original format. Begin!'
    } else {
        customPrompt = customPrompt.replace(/\$lang/g, lang);
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    // 加载图像并压缩
    const compressedBase64 = await compressImage(base64);

    const body = {
        model,
        messages: [
            {
                "role": "system",
                "content": [{ "type": "text", "text": customPrompt }],
            },
            {
                "role": "user",
                "content": [{
                    "type": "image_url",
                    "image_url": {
                        "url": `data:image/jpeg;base64,${compressedBase64}`,
                        "detail": "high"
                    },
                }],
            }
        ],
    };

    try {
        const res = await fetch(url.toString(), {
            method: 'POST',
            headers: headers,
            body: {
                type: "Json",
                payload: body
            }
        });

        if (res.ok) {
            return res.data.choices[0].message.content;
        } else {
            throw new Error(JSON.stringify(res.data));
        }
    } catch (error) {
        throw error;
    }
}

async function compressImage(base64) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = `data:image/png;base64,${base64}`;

        img.onload = () => {
            const maxSize = 1400;
            const ratio = maxSize / Math.max(img.width, img.height);
            const newWidth = Math.floor(img.width * ratio);
            const newHeight = Math.floor(img.height * ratio);

            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve(compressedDataUrl.split(',')[1]);
        };

        img.onerror = (error) => {
            reject(new Error("Image loading error: " + error));
        };
    });
}
