async function recognize(base64, lang, options) {
    const { config, utils } = options;
    const { tauriFetch: fetch } = utils;
    const {
        model = "gpt-4o", 
        apiKey, 
        requestPath, 
        customPrompt
    } = config;

    // 验证输入参数
    if (!base64) {
        throw new Error('Base64 image data is required');
    }
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

    try {
        // 加载图像并压缩
        const compressedBase64 = await compressImage(base64);

        const body = {
            model,
            max_tokens: 4096,
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

        // 安全地获取响应内容
        const responseData = response.data;
        if (!responseData || !responseData.choices || !responseData.choices[0]) {
            throw new Error('Invalid API response structure');
        }

        // 返回识别的文本内容
        return responseData.choices[0].message.content || '';

    } catch (error) {
        // 详细的错误日志
        console.error('Full error details:', error);
        
        // 区分不同类型的错误
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Network error: Unable to connect to the API');
        }
        if (error.message.includes('API Request Failed')) {
            throw error;
        }
        // 默认错误处理
        throw new Error(`OCR Recognition Error: ${error.message ||'Unknown error occurred'}`);
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
        // 安全检查
        if (!base64) {
            reject(new Error('No base64 image data provided'));
            return;
        }

        const img = new Image();
        
        // 添加超时处理
        const timeoutId = setTimeout(() => {
            reject(new Error('Image loading timed out'));
        }, 10000);

        img.onload = () => {
            clearTimeout(timeoutId);
            
            try {
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
            } catch (drawError) {
                reject(new Error(`Image processing error: ${drawError.message}`));
            }
        };

        img.onerror = (error) => {
            clearTimeout(timeoutId);
            reject(new Error(`Image loading error: ${error.message}`));
        };

        //尝试加载图像
        try {
            img.src = `data:image/png;base64,${base64}`;
        } catch (srcError) {
            clearTimeout(timeoutId);
            reject(new Error(`Error setting image source: ${srcError.message}`));
        }
    });
}
