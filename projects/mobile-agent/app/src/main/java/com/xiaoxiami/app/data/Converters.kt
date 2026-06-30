package com.xiaoxiami.app.data

import androidx.room.TypeConverter
import com.xiaoxiami.app.data.memory.MemoryType

class Converters {
    @TypeConverter
    fun fromMemoryType(value: MemoryType): String = value.name
    
    @TypeConverter
    fun toMemoryType(value: String): MemoryType = runCatching { 
        MemoryType.valueOf(value) 
    }.getOrDefault(MemoryType.FACT)
}

