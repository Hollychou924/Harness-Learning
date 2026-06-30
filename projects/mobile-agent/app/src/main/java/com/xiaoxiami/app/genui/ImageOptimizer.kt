package com.xiaoxiami.app.genui

/**
 * 图片优化工具 - 提供给WebView使用的图片处理功能
 * 
 * 主要功能:
 * 1. 图片占位符机制(防止布局抖动)
 * 2. 图片预加载和尺寸获取
 * 3. 宽高比计算和平滑过渡
 * 4. 图片状态缓存
 */
object ImageOptimizer {
    
    /**
     * 生成图片占位符的JavaScript代码
     */
    fun getPlaceholderScript(): String = """
        // ==================== 图片优化工具(占位符+预加载+缓存) ====================
        
        // 全局图片缓存
        window.__imageCache = window.__imageCache || new Map();
        window.__processedImages = window.__processedImages || new Set();
        
        /**
         * 创建图片占位符
         * @param {string} src - 图片源地址
         * @param {string} id - 占位符ID
         * @param {number} [height=200] - 默认高度
         * @returns {HTMLDivElement} 占位符元素
         */
        window.createImagePlaceholder = function(src, id, height) {
            height = height || 200;
            
            const placeholder = document.createElement('div');
            placeholder.id = id;
            placeholder.dataset.imgSrc = src;
            placeholder.style.cssText = [
                'height: ' + height + 'px',
                'width: 100%',
                'background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)',
                'display: flex',
                'align-items: center',
                'justify-content: center',
                'border-radius: 12px',
                'margin: 16px 0',
                'overflow: hidden',
                'position: relative'
            ].join(';');
            
            // 添加加载动画
            const loadingContainer = document.createElement('div');
            loadingContainer.style.cssText = [
                'display: flex',
                'flex-direction: column',
                'align-items: center',
                'gap: 12px'
            ].join(';');
            
            // 旋转动画
            const spinner = document.createElement('div');
            spinner.style.cssText = [
                'width: 24px',
                'height: 24px',
                'border: 2px solid #e0e0e0',
                'border-top: 2px solid #667eea',
                'border-radius: 50%',
                'animation: imgSpinner 0.8s linear infinite'
            ].join(';');
            
            const text = document.createElement('span');
            text.textContent = '图片加载中...';
            text.style.cssText = [
                'color: #9ca3af',
                'font-size: 12px'
            ].join(';');
            
            loadingContainer.appendChild(spinner);
            loadingContainer.appendChild(text);
            placeholder.appendChild(loadingContainer);
            
            // 添加旋转动画样式(仅添加一次)
            if (!document.getElementById('img-spinner-style')) {
                const styleSheet = document.createElement('style');
                styleSheet.id = 'img-spinner-style';
                styleSheet.textContent = '@keyframes imgSpinner{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}';
                document.head.appendChild(styleSheet);
            }
            
            return placeholder;
        };
        
        /**
         * 预加载图片并获取尺寸
         * @param {string} src - 图片源地址
         * @returns {Promise<{width:number,height:number}>} 图片尺寸
         */
        window.preloadImage = function(src) {
            return new Promise(function(resolve, reject) {
                // 检查缓存
                if (window.__imageCache.has(src)) {
                    const cached = window.__imageCache.get(src);
                    if (cached.status === 'loaded') {
                        resolve(cached.dimensions);
                        return;
                    } else if (cached.status === 'error') {
                        reject(new Error('Image previously failed'));
                        return;
                    } else if (cached.status === 'loading' && cached.promise) {
                        cached.promise.then(resolve).catch(reject);
                        return;
                    }
                }
                
                // 标记为加载中
                var promiseResolve, promiseReject;
                var loadPromise = new Promise(function(res, rej) {
                    promiseResolve = res;
                    promiseReject = rej;
                });
                
                window.__imageCache.set(src, {
                    status: 'loading',
                    dimensions: null,
                    promise: loadPromise
                });
                
                // 创建图片元素并加载
                var img = new Image();
                
                img.onload = function() {
                    var dimensions = {
                        width: img.naturalWidth,
                        height: img.naturalHeight
                    };
                    window.__imageCache.set(src, {
                        status: 'loaded',
                        dimensions: dimensions,
                        promise: null
                    });
                    promiseResolve(dimensions);
                    resolve(dimensions);
                };
                
                img.onerror = function() {
                    window.__imageCache.set(src, {
                        status: 'error',
                        dimensions: null,
                        promise: null
                    });
                    promiseReject(new Error('Image load failed'));
                    reject(new Error('Image load failed'));
                };
                
                img.src = src;
            });
        };
        
        /**
         * 加载图片到占位符(带宽高比计算和平滑过渡)
         * @param {HTMLDivElement} placeholder - 占位符元素
         */
        window.loadImageToPlaceholder = async function(placeholder) {
            if (!placeholder || !placeholder.dataset.imgSrc) return;
            
            var src = placeholder.dataset.imgSrc;
            
            // 检查是否已处理
            if (window.__processedImages.has(src + '_' + placeholder.id)) {
                return;
            }
            window.__processedImages.add(src + '_' + placeholder.id);
            
            try {
                // 预加载获取尺寸
                var dimensions = await window.preloadImage(src);
                
                // 创建图片元素
                var img = document.createElement('img');
                img.src = src;
                img.alt = placeholder.dataset.alt || '';
                img.style.cssText = [
                    'width: 100%',
                    'height: auto',
                    'object-fit: contain',
                    'border-radius: 12px',
                    'opacity: 0',
                    'transition: opacity 0.3s ease-in-out'
                ].join(';');
                
                // 计算宽高比
                var containerWidth = placeholder.offsetWidth || 300;
                var aspectRatio = dimensions.height / dimensions.width;
                var calculatedHeight = containerWidth * aspectRatio;
                
                // 设置容器高度(平滑过渡)
                placeholder.style.transition = 'height 0.3s ease-in-out, background 0.3s ease-in-out';
                placeholder.style.height = calculatedHeight + 'px';
                placeholder.style.background = 'transparent';
                
                // 清空占位符内容并添加图片
                placeholder.innerHTML = '';
                placeholder.appendChild(img);
                
                // 图片加载完成后淡入
                if (img.complete) {
                    requestAnimationFrame(function() {
                        img.style.opacity = '1';
                    });
                } else {
                    img.onload = function() {
                        requestAnimationFrame(function() {
                            img.style.opacity = '1';
                        });
                    };
                }
                
            } catch (e) {
                // 加载失败,显示错误信息
                placeholder.style.transition = 'all 0.3s ease-in-out';
                placeholder.style.background = '#fef2f2';
                placeholder.style.height = '100px';
                placeholder.innerHTML = '<div style="color:#ef4444;font-size:12px;">图片加载失败</div>';
            }
        };
        
        /**
         * 批量加载所有待处理的图片占位符
         */
        window.loadAllPendingImages = function() {
            var placeholders = document.querySelectorAll('[data-img-src]');
            placeholders.forEach(function(placeholder) {
                window.loadImageToPlaceholder(placeholder);
            });
        };
        
        /**
         * 替换HTML中的img标签为占位符
         * @param {string} html - 原始HTML
         * @returns {string} 处理后的HTML
         */
        window.replaceImgWithPlaceholder = function(html) {
            var counter = window.__imgPlaceholderCounter || 0;
            
            var result = html.replace(/<img\s+([^>]*)\/?>/gi, function(match, attrs) {
                counter++;
                var id = 'img-placeholder-' + counter;
                
                // 提取src
                var srcMatch = attrs.match(/src\s*=\s*["']([^"']+)["']/i);
                var src = srcMatch ? srcMatch[1] : '';
                
                // 提取alt
                var altMatch = attrs.match(/alt\s*=\s*["']([^"']+)["']/i);
                var alt = altMatch ? altMatch[1] : '';
                
                if (!src) return match; // 无src则保留原样
                
                return '<div id="' + id + '" data-img-src="' + src + '" data-alt="' + alt + '" style="height:200px;width:100%;background:linear-gradient(135deg,#f5f7fa 0%,#e8ecf1 100%);display:flex;align-items:center;justify-content:center;border-radius:12px;margin:16px 0;"><div style="color:#9ca3af;font-size:12px;">图片加载中...</div></div>';
            });
            
            window.__imgPlaceholderCounter = counter;
            return result;
        };
        
        // 标记图片优化工具已加载
        window.__imageOptimizerLoaded = true;
        console.log('GenUI: Image optimizer loaded');
    """.trimIndent()
    
    /**
     * 生成触发图片加载的JavaScript代码
     */
    fun getTriggerLoadScript(): String = """
        if (window.loadAllPendingImages) {
            window.loadAllPendingImages();
        }
    """.trimIndent()
}
