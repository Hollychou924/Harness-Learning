package com.xiaoxiami.app.genui

/**
 * DOM渲染优化工具 - 提供批量DOM操作和硬件加速
 * 
 * 主要功能:
 * 1. 批量DOM操作(使用DocumentFragment减少重排)
 * 2. 硬件加速(GPU渲染)
 * 3. 平台适配优化
 */
object DOMRenderOptimizer {
    
    /**
     * 生成批量DOM操作的JavaScript代码
     */
    fun getBatchDOMScript(): String = """
        // ==================== 批量DOM操作工具 ====================
        
        // DOM事件队列
        window.__domEventQueue = window.__domEventQueue || [];
        window.__isProcessingQueue = false;
        window.__batchSize = 10; // 每批处理10个事件
        window.__batchInterval = 16; // 约60fps的刷新率
        
        /**
         * 批量追加DOM内容(使用DocumentFragment减少重排)
         * @param {string} html - 要追加的HTML内容
         * @param {string} [targetId='app'] - 目标容器ID
         */
        window.batchAppendDOM = function(html, targetId) {
            targetId = targetId || 'app';
            var target = document.getElementById(targetId);
            if (!target) {
                console.warn('GenUI: Target element not found:', targetId);
                return;
            }
            
            // 应用图片占位符替换
            if (window.replaceImgWithPlaceholder) {
                html = window.replaceImgWithPlaceholder(html);
            }
            
            // 创建临时容器解析HTML
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            // 使用DocumentFragment批量插入
            var fragment = document.createDocumentFragment();
            while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
            }
            
            // 一次性插入DOM
            target.appendChild(fragment);
            
            // 触发图片加载
            if (window.loadAllPendingImages) {
                setTimeout(window.loadAllPendingImages, 50);
            }
        };
        
        /**
         * 将DOM事件加入队列
         * @param {Object} event - DOM事件 {type: 'text'|'dom', content: '...'}
         */
        window.queueDOMEvent = function(event) {
            window.__domEventQueue.push(event);
            
            if (!window.__isProcessingQueue) {
                window.__isProcessingQueue = true;
                requestAnimationFrame(window.processDOMQueue);
            }
        };
        
        /**
         * 处理DOM事件队列(批量执行)
         */
        window.processDOMQueue = function() {
            if (window.__domEventQueue.length === 0) {
                window.__isProcessingQueue = false;
                return;
            }
            
            var target = document.getElementById('app');
            if (!target) {
                window.__isProcessingQueue = false;
                return;
            }
            
            // 取出一批事件
            var batch = window.__domEventQueue.splice(0, window.__batchSize);
            
            // 使用DocumentFragment批量插入
            var fragment = document.createDocumentFragment();
            var htmlBuffer = '';
            
            batch.forEach(function(event) {
                if (event.type === 'text') {
                    // 文本内容直接追加到缓冲区
                    htmlBuffer += event.content;
                } else if (event.type === 'dom') {
                    // DOM内容
                    htmlBuffer += event.content;
                }
            });
            
            if (htmlBuffer) {
                // 应用图片占位符替换
                if (window.replaceImgWithPlaceholder) {
                    htmlBuffer = window.replaceImgWithPlaceholder(htmlBuffer);
                }
                
                var tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlBuffer;
                
                while (tempDiv.firstChild) {
                    fragment.appendChild(tempDiv.firstChild);
                }
                
                target.appendChild(fragment);
            }
            
            // 继续处理剩余队列
            if (window.__domEventQueue.length > 0) {
                setTimeout(function() {
                    requestAnimationFrame(window.processDOMQueue);
                }, window.__batchInterval);
            } else {
                window.__isProcessingQueue = false;
                
                // 所有事件处理完毕后加载图片
                if (window.loadAllPendingImages) {
                    setTimeout(window.loadAllPendingImages, 100);
                }
            }
        };
        
        /**
         * 直接追加DOM内容(带智能优化)
         * @param {string} content - 内容
         * @param {string} type - 类型 'text'|'dom'
         */
        window.appendDOMContent = function(content, type) {
            type = type || 'text';
            window.queueDOMEvent({ type: type, content: content });
        };
        
        console.log('GenUI: Batch DOM tools loaded');
    """.trimIndent()
    
    /**
     * 生成硬件加速的JavaScript代码
     */
    fun getHardwareAccelerationScript(): String = """
        // ==================== 硬件加速优化 ====================
        
        /**
         * 检测平台
         */
        window.detectPlatform = function() {
            var ua = navigator.userAgent || '';
            if (/Android/i.test(ua)) return 'android';
            if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
            if (/Mac/i.test(ua)) return 'macos';
            if (/Windows/i.test(ua)) return 'windows';
            if (/Linux/i.test(ua)) return 'linux';
            return 'unknown';
        };
        
        /**
         * 应用硬件加速样式
         */
        window.applyHardwareAcceleration = function() {
            var platform = window.detectPlatform();
            var app = document.getElementById('app');
            if (!app) return;
            
            // 基础硬件加速
            app.style.transform = 'translate3d(0,0,0)';
            app.style.backfaceVisibility = 'hidden';
            app.style.perspective = '1000px';
            
            // 平台特定优化
            switch (platform) {
                case 'android':
                    // Android优化
                    app.style.willChange = 'transform';
                    break;
                    
                case 'ios':
                    // iOS优化
                    app.style.WebkitOverflowScrolling = 'touch';
                    app.style.WebkitTransform = 'translateZ(0)';
                    break;
                    
                case 'macos':
                    // macOS优化
                    app.style.contentVisibility = 'auto';
                    app.style.containIntrinsicSize = '100px';
                    break;
                    
                default:
                    // 通用优化
                    break;
            }
            
            // 添加优化样式表
            if (!document.getElementById('hw-accel-style')) {
                var style = document.createElement('style');
                style.id = 'hw-accel-style';
                style.textContent = [
                    '#app { contain: layout style paint; }',
                    '#app > * { transform: translateZ(0); }',
                    'img { will-change: opacity; }',
                    '.fade-in { animation: fadeIn 0.3s ease-in-out; }',
                    '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }'
                ].join('\\n');
                document.head.appendChild(style);
            }
            
            console.log('GenUI: Hardware acceleration applied for', platform);
        };
        
        /**
         * 优化滚动性能
         */
        window.optimizeScrollPerformance = function() {
            var app = document.getElementById('app');
            if (!app) return;
            
            // 使用passive事件监听
            app.addEventListener('scroll', function() {}, { passive: true });
            app.addEventListener('touchstart', function() {}, { passive: true });
            app.addEventListener('touchmove', function() {}, { passive: true });
            
            console.log('GenUI: Scroll performance optimized');
        };
        
        // 自动应用优化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                window.applyHardwareAcceleration();
                window.optimizeScrollPerformance();
            });
        } else {
            window.applyHardwareAcceleration();
            window.optimizeScrollPerformance();
        }
        
        console.log('GenUI: Hardware acceleration tools loaded');
    """.trimIndent()
    
    /**
     * 获取完整的渲染优化脚本
     */
    fun getFullOptimizationScript(): String = """
        ${getBatchDOMScript()}
        
        ${getHardwareAccelerationScript()}
    """.trimIndent()
}
