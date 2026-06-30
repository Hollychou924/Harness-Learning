package com.xiaoxiami.app.genui

/**
 * DOM状态机 - 用于流式HTML解析和优化
 * 
 * 核心功能:
 * 1. DOM级别粒度的流式输出(而非字符级别)
 * 2. 自动为每个DOM元素注入唯一ID(dom_1, dom_2...)
 * 3. 智能识别不完整HTML,等待完整后再输出
 * 4. 小批次文本输出,避免大段文本一次性输出
 */
class DOMStateMachine {
    
    // 缓冲区
    private val buffer = StringBuilder()
    
    // DOM ID计数器
    private var domIdCounter = 1
    
    // 完整HTML累积
    private val fullHtml = StringBuilder()
    
    // 配置
    private val charBatchSize = 50  // 每50个字符输出一次
    
    /**
     * DOM事件类型
     */
    enum class EventType {
        TEXT,   // 纯文本
        DOM,    // DOM元素
        ERROR   // 错误
    }
    
    /**
     * DOM事件
     */
    data class DOMEvent(
        val type: EventType,
        val content: String,
        val id: String? = null  // DOM元素的ID
    )
    
    /**
     * 解析单个chunk,返回DOM事件列表
     */
    fun parseChunk(chunk: String): List<DOMEvent> {
        val outputs = mutableListOf<DOMEvent>()
        buffer.append(chunk)
        
        while (buffer.isNotEmpty()) {
            val bufferStr = buffer.toString()
            
            // 1. 处理纯文本(不包含<)
            if ("<" !in bufferStr) {
                if (bufferStr.length <= charBatchSize) {
                    // 剩余文本不足批次,直接输出
                    if (bufferStr.isNotEmpty()) {
                        fullHtml.append(bufferStr)
                        outputs.add(DOMEvent(EventType.TEXT, bufferStr))
                        buffer.clear()
                    }
                    break
                } else {
                    // 拆分小批次文本输出
                    val textPart = bufferStr.substring(0, charBatchSize)
                    fullHtml.append(textPart)
                    outputs.add(DOMEvent(EventType.TEXT, textPart))
                    buffer.delete(0, charBatchSize)
                }
                continue
            }
            
            // 2. 提取<之前的文本
            val firstLt = bufferStr.indexOf('<')
            if (firstLt > 0) {
                val textPart = bufferStr.substring(0, firstLt)
                if (textPart.length > charBatchSize) {
                    // 先输出部分文本
                    val partialText = textPart.substring(0, charBatchSize)
                    outputs.add(DOMEvent(EventType.TEXT, partialText))
                    fullHtml.append(partialText)
                    buffer.delete(0, charBatchSize)
                    continue
                } else {
                    // 文本不足批次,直接输出
                    fullHtml.append(textPart)
                    outputs.add(DOMEvent(EventType.TEXT, textPart))
                    buffer.delete(0, firstLt)
                }
            }
            
            // 3. 处理标签部分
            val currentBuffer = buffer.toString()
            if (">" !in currentBuffer) {
                break  // 不完整标签,等待下一批
            }
            
            val firstGt = currentBuffer.indexOf('>')
            val tagCandidate = currentBuffer.substring(0, firstGt + 1)
            val inner = tagCandidate.substring(1, tagCandidate.length - 1)
            
            // 4. 处理完整标签
            if ("<" !in inner) {
                var processedTag = tagCandidate
                
                // 给非闭合标签添加ID
                if (!tagCandidate.startsWith("</") && !tagCandidate.endsWith("/>")) {
                    processedTag = injectId(tagCandidate)
                }
                
                // 输出处理后的标签
                fullHtml.append(processedTag)
                val domId = if (!tagCandidate.startsWith("</") && !tagCandidate.endsWith("/>")) {
                    "dom_${domIdCounter - 1}"
                } else null
                outputs.add(DOMEvent(EventType.DOM, processedTag, domId))
                buffer.delete(0, firstGt + 1)
            } else {
                // 不完整或错误的标签片段
                outputs.add(DOMEvent(EventType.ERROR, "不完整或错误的标签片段"))
                break
            }
        }
        
        return outputs
    }
    
    /**
     * 为标签注入ID
     */
    private fun injectId(tag: String): String {
        val inner = tag.substring(1, tag.length - 1)
        val tagNameEnd = if (" " in inner) inner.indexOf(' ') else inner.length
        val tagName = inner.substring(0, tagNameEnd)
        
        val newTag = if (" " in tag) {
            tag.replaceFirst(
                "<$tagName",
                "<$tagName id=\"dom_${domIdCounter}\""
            )
        } else {
            "<$tagName id=\"dom_${domIdCounter}\">"
        }
        
        domIdCounter++
        return newTag
    }
    
    /**
     * 刷新剩余缓冲区
     */
    fun flushBuffer(): List<DOMEvent> {
        val outputs = mutableListOf<DOMEvent>()
        
        while (buffer.isNotEmpty()) {
            val bufferStr = buffer.toString()
            if (bufferStr.length > charBatchSize) {
                val textPart = bufferStr.substring(0, charBatchSize)
                fullHtml.append(textPart)
                outputs.add(DOMEvent(EventType.TEXT, textPart))
                buffer.delete(0, charBatchSize)
            } else {
                fullHtml.append(bufferStr)
                outputs.add(DOMEvent(EventType.TEXT, bufferStr))
                buffer.clear()
            }
        }
        
        return outputs
    }
    
    /**
     * 获取完整的HTML内容
     */
    fun getFullHtml(): String = fullHtml.toString()
    
    /**
     * 重置状态机
     */
    fun reset() {
        buffer.clear()
        fullHtml.clear()
        domIdCounter = 1
    }
    
    /**
     * 获取当前DOM ID计数
     */
    fun getCurrentDomCount(): Int = domIdCounter - 1
}
