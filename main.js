async function recognize(base64, lang, options) {
    const { config, utils } = options;
    const { tauriFetch: fetch } = utils;
    const {
        model = "gpt-4o", 
        apiKey, 
        requestPath, 
        customPrompt 
    } = config;

    // 验证必要参数
    if (!apiKey) {
        throw new Error('API Key is required');
    }

    // 处理 requestPath
    const url = new URL(requestPath || "https://api.openai.com/v1/chat/completions");
    if (!url.pathname.endsWith('/chat/completions')) {
        url.pathname = '/v1/chat/completions';
    }

    // 设置默认提示词
    const systemPrompt = customPrompt 
        ? customPrompt.replace(/\$lang/g, lang)
        : 'You are an advanced OCR system. Extract all text from the image precisely.';

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
                "content": systemPrompt
            },
            {
                "role": "user",
                "content": [{
                    "type": "image_url",
                    "image_url": {
                        "url": `data:image/jpeg;base64,${compressedBase64}`,
                        "detail": "high"
                    }
                }]
            }
        ]
    };

    try {
        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: headers,
            body: {
                type: "Json",
                payload: body
            }
        });

        // 详细的错误处理
        if (!response.ok) {
            const errorDetails = await parseErrorResponse(response);
            throw new Error(`API Request Failed: ${errorDetails}`);
        }

        // 返回识别的文本内容
        return response.data.choices[0].message.content;

    } catch (error) {
        // 捕获并详细记录错误
        throw new Error(`OCR Recognition Error: ${error.message}`);
    }
}

// 解析详细的错误响应
async function parseErrorResponse(response) {
    try {
        const errorBody = await response.data;
        return JSON.stringify({
            status: response.status,
            statusText: response.statusText,
            errorDetails: errorBody
        }, null, 2);
    } catch (parseError) {
        return `Unable to parse error details. Status: ${response.status}, ${response.statusText}`;
    }
}

// 压缩图像的函数
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
            resolve(compressedDataUrl.split(',')[1]); // 返回压缩后的 base64 数据
        };

        img.onerror = (error) => {
            reject(new Error("Image loading error: " + error));
        };
    });
}
