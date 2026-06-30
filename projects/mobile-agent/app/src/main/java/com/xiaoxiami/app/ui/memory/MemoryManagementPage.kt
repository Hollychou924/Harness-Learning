package com.xiaoxiami.app.ui.memory

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.Lightbulb
import androidx.compose.material.icons.outlined.Psychology
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.xiaoxiami.app.data.memory.LongTermMemory
import com.xiaoxiami.app.data.memory.MemoryType
import com.xiaoxiami.app.viewmodel.MemoryViewModel
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * 长期记忆管理页面。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MemoryManagementPage(
    onBack: () -> Unit,
    viewModel: MemoryViewModel = viewModel()
) {
    var searchQuery by remember { mutableStateOf("") }
    var isSearchExpanded by remember { mutableStateOf(false) }

    val longTermMemories by viewModel.longTermMemoriesByType.collectAsState()
    val searchedLongTerm by viewModel.searchedLongTermMemories.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.refreshStats()
    }

    BackHandler(onBack = onBack)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF8F8F8))
    ) {
        TopAppBar(
            title = {
                Text(
                    text = "记忆管理",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
            },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(
                        imageVector = Icons.Outlined.ArrowBack,
                        contentDescription = "返回",
                        tint = Color(0xFF1A1A1A)
                    )
                }
            },
            actions = {
                IconButton(
                    onClick = {
                        isSearchExpanded = !isSearchExpanded
                        if (!isSearchExpanded) {
                            searchQuery = ""
                            viewModel.clearSearch()
                        }
                    }
                ) {
                    Icon(
                        imageVector = if (isSearchExpanded) Icons.Filled.SearchOff else Icons.Outlined.Search,
                        contentDescription = if (isSearchExpanded) "关闭搜索" else "搜索",
                        tint = if (isSearchExpanded) Color(0xFF1A1A1A) else Color(0xFF666666)
                    )
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
        )

        AnimatedVisibility(
            visible = isSearchExpanded,
            enter = expandVertically() + fadeIn(),
            exit = shrinkVertically() + fadeOut()
        ) {
            SearchBar(
                query = searchQuery,
                onQueryChange = {
                    searchQuery = it
                    viewModel.updateSearchQuery(it)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            )
        }

        LongTermMemoryList(
            memories = if (searchQuery.isBlank()) longTermMemories else searchedLongTerm.groupBy { it.type },
            onDeleteMemory = { viewModel.deleteLongTermMemory(it) },
            modifier = Modifier.fillMaxSize()
        )
    }
}

@Composable
private fun SearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .height(48.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(Color.White)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Outlined.Search,
                contentDescription = "搜索",
                tint = Color(0xFF999999),
                modifier = Modifier.size(20.dp)
            )

            Spacer(modifier = Modifier.width(8.dp))

            BasicTextField(
                value = query,
                onValueChange = onQueryChange,
                textStyle = LocalTextStyle.current.copy(
                    fontSize = 15.sp,
                    color = Color(0xFF333333)
                ),
                decorationBox = { innerTextField ->
                    if (query.isEmpty()) {
                        Text(
                            text = "搜索长期记忆...",
                            fontSize = 15.sp,
                            color = Color(0xFF999999)
                        )
                    }
                    innerTextField()
                },
                modifier = Modifier.weight(1f)
            )

            if (query.isNotEmpty()) {
                IconButton(
                    onClick = { onQueryChange("") },
                    modifier = Modifier.size(20.dp)
                ) {
                    Icon(
                        imageVector = Icons.Filled.Close,
                        contentDescription = "清空",
                        tint = Color(0xFF999999),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun SwipeToDeleteItem(
    onDelete: () -> Unit,
    content: @Composable () -> Unit
) {
    val density = LocalDensity.current
    val actionWidth = 100.dp
    val actionWidthPx = with(density) { actionWidth.toPx() }
    val offsetX = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()

    Box(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = Alignment.CenterStart
    ) {
        if (offsetX.value < -1f) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0xFFE53935)),
                contentAlignment = Alignment.CenterEnd
            ) {
                Column(
                    modifier = Modifier
                        .width(actionWidth)
                        .fillMaxHeight()
                        .clickable {
                            onDelete()
                        },
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Delete,
                        contentDescription = "删除",
                        tint = Color.White
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "删除",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }
            }
        }

        Box(
            modifier = Modifier
                .offset { IntOffset(offsetX.value.roundToInt(), 0) }
                .fillMaxWidth()
                .draggable(
                    orientation = Orientation.Horizontal,
                    state = rememberDraggableState { delta ->
                        scope.launch {
                            val target = (offsetX.value + delta).coerceIn(-actionWidthPx * 1.5f, 0f)
                            offsetX.snapTo(target)
                        }
                    },
                    onDragStopped = {
                        val targetOffset = if (offsetX.value < -actionWidthPx / 2) -actionWidthPx else 0f
                        offsetX.animateTo(
                            targetValue = targetOffset,
                            animationSpec = tween(durationMillis = 300)
                        )
                    }
                )
        ) {
            content()
        }
    }
}

@Composable
private fun LongTermMemoryList(
    memories: Map<MemoryType, List<LongTermMemory>>,
    onDeleteMemory: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedSubTab by remember { mutableStateOf(0) }
    val tabs = listOf("全部", "事实", "偏好", "决策", "教训")

    val filteredList = remember(memories, selectedSubTab) {
        val allMemories = memories.values.flatten().sortedByDescending { it.updatedAt }
        when (selectedSubTab) {
            0 -> allMemories
            1 -> (memories[MemoryType.FACT] ?: emptyList()).sortedByDescending { it.updatedAt }
            2 -> (memories[MemoryType.PREFERENCE] ?: emptyList()).sortedByDescending { it.updatedAt }
            3 -> (memories[MemoryType.DECISION] ?: emptyList()).sortedByDescending { it.updatedAt }
            4 -> (memories[MemoryType.LESSON] ?: emptyList()).sortedByDescending { it.updatedAt }
            else -> emptyList()
        }
    }

    Column(modifier = modifier) {
        TabRow(
            selectedTabIndex = selectedSubTab,
            containerColor = Color.Transparent,
            divider = {},
            indicator = { positions ->
                TabRowDefaults.SecondaryIndicator(
                    modifier = Modifier.tabIndicatorOffset(positions[selectedSubTab]),
                    color = Color(0xFF1A1A1A)
                )
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedSubTab == index,
                    onClick = { selectedSubTab = index },
                    text = {
                        Text(
                            text = title,
                            fontSize = 14.sp,
                            fontWeight = if (selectedSubTab == index) FontWeight.Bold else FontWeight.Normal,
                            color = if (selectedSubTab == index) Color(0xFF1A1A1A) else Color(0xFF666666)
                        )
                    }
                )
            }
        }

        if (filteredList.isEmpty()) {
            EmptyState(
                icon = Icons.Outlined.Psychology,
                message = "暂无长期记忆",
                modifier = Modifier.fillMaxSize()
            )
            return@Column
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(filteredList, key = { it.id }) { memory ->
                SwipeToDeleteItem(
                    onDelete = { onDeleteMemory(memory.id) }
                ) {
                    LongTermMemoryCard(memory = memory)
                }
            }
        }
    }
}

@Composable
private fun LongTermMemoryCard(memory: LongTermMemory) {
    var expanded by remember { mutableStateOf(false) }
    val (typeIcon, typeLabel, typeColor) = when (memory.type) {
        MemoryType.FACT -> Triple(Icons.Outlined.Lightbulb, "事实", Color(0xFF1E88E5))
        MemoryType.PREFERENCE -> Triple(Icons.Outlined.Favorite, "偏好", Color(0xFFFF9800))
        MemoryType.DECISION -> Triple(Icons.Outlined.CheckCircle, "决策", Color(0xFF43A047))
        MemoryType.LESSON -> Triple(Icons.Outlined.School, "经验", Color(0xFFE53935))
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded }
                .padding(16.dp)
        ) {
            Text(
                text = memory.content,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = Color(0xFF1A1A1A),
                lineHeight = 21.sp,
                maxLines = if (expanded) Int.MAX_VALUE else 3,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ImportanceIndicator(importance = memory.importance)
                MetadataChip(icon = typeIcon, text = typeLabel, color = typeColor)
                MetadataChip(icon = Icons.Outlined.Schedule, text = memory.sourceDate)
                if (memory.usageCount > 0) {
                    MetadataChip(
                        icon = Icons.Outlined.Visibility,
                        text = "命中 ${memory.usageCount} 次"
                    )
                }
            }

            AnimatedVisibility(visible = expanded) {
                Column(modifier = Modifier.padding(top = 12.dp)) {
                    Divider(color = Color(0xFFEEEEEE), thickness = 1.dp)
                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = "分类：${memory.category}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xFF333333)
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "来源会话：${memory.getSourceSessionIdList().size} 个",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xFF666666)
                    )
                    if (memory.relatedMemoryIds.isNotBlank()) {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "关联记忆：${memory.getRelatedMemoryIdList().size} 条",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFF666666)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ImportanceIndicator(importance: Int) {
    val color = when {
        importance >= 8 -> Color(0xFFE53935)
        importance >= 5 -> Color(0xFFFF9800)
        else -> Color(0xFF4CAF50)
    }

    Box(
        modifier = Modifier
            .size(8.dp)
            .clip(CircleShape)
            .background(color)
    )
}

@Composable
private fun MetadataChip(
    icon: ImageVector,
    text: String,
    color: Color = Color(0xFF666666)
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = color,
            modifier = Modifier.size(14.dp)
        )
        Text(
            text = text,
            fontSize = 12.sp,
            color = color
        )
    }
}

@Composable
private fun EmptyState(
    icon: ImageVector,
    message: String,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = Color(0xFFBDBDBD),
                modifier = Modifier.size(64.dp)
            )
            Text(
                text = message,
                fontSize = 15.sp,
                color = Color(0xFF999999)
            )
        }
    }
}
