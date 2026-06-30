package com.xiaoxiami.app.ui.skills

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Build
import androidx.compose.material.icons.outlined.Code
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Extension
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.xiaoxiami.app.agent.skills.SkillManifest
import com.xiaoxiami.app.agent.skills.SkillManager
import com.xiaoxiami.app.agent.skills.SkillSourceKind
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SkillsPage(
    onBack: () -> Unit
) {
    BackHandler { onBack() }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val skillManager = remember { SkillManager(context) }
    val allSkills by skillManager.allSkills.collectAsState()

    var selectedSkill by remember { mutableStateOf<SkillManifest?>(null) }
    var searchQuery by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        skillManager.refreshSkills()
    }

    if (selectedSkill != null) {
        SkillDetailPage(
            skill = selectedSkill!!,
            onBack = { selectedSkill = null }
        )
        return
    }

    val filteredSkills = if (searchQuery.isBlank()) {
        allSkills
    } else {
        allSkills.filter { skill ->
            skill.title.contains(searchQuery, ignoreCase = true) ||
                skill.description.contains(searchQuery, ignoreCase = true) ||
                skill.id.contains(searchQuery, ignoreCase = true)
        }
    }

    // Group by category
    val groupedSkills = filteredSkills.groupBy { it.category }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF8F8F8))
    ) {
        TopAppBar(
            title = {
                Text(
                    "技能商店",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold
                )
            },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.Outlined.ArrowBack, contentDescription = "Back")
                }
            },
            actions = {
                Text(
                    "已启用 ${allSkills.count { it.enabled }}/${allSkills.size}",
                    fontSize = 13.sp,
                    color = Color.Gray,
                    modifier = Modifier.padding(end = 16.dp)
                )
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = Color(0xFFF8F8F8)
            )
        )

        // Search bar
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 4.dp),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(0.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Outlined.Search,
                    contentDescription = null,
                    tint = Color.Gray,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                androidx.compose.foundation.text.BasicTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    singleLine = true,
                    textStyle = androidx.compose.ui.text.TextStyle(
                        fontSize = 15.sp,
                        color = Color.Black
                    ),
                    decorationBox = { inner ->
                        if (searchQuery.isEmpty()) {
                            Text("搜索技能、分类或 ID", fontSize = 15.sp, color = Color.Gray)
                        }
                        inner()
                    },
                    modifier = Modifier.weight(1f)
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        LazyColumn(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            for ((category, skills) in groupedSkills.toSortedMap()) {
                item(key = "header_$category") {
                    CategoryHeader(category = category, count = skills.size)
                }
                items(
                    items = skills,
                    key = { it.id }
                ) { skill ->
                    SkillCard(
                        skill = skill,
                        onToggle = { enabled ->
                            scope.launch {
                                skillManager.toggleSkill(skill.id, enabled)
                            }
                        },
                        onClick = { selectedSkill = skill }
                    )
                }
                item(key = "spacer_$category") {
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }
    }
}

@Composable
private fun CategoryHeader(category: String, count: Int) {
    val (icon, label) = getCategoryInfo(category)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = Color(0xFF666666),
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color(0xFF666666)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            "($count)",
            fontSize = 12.sp,
            color = Color.Gray
        )
    }
}

@Composable
private fun SkillCard(
    skill: SkillManifest,
    onToggle: (Boolean) -> Unit,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (skill.enabled) Color.White else Color(0xFFF0F0F0)
        ),
        elevation = CardDefaults.cardElevation(if (skill.enabled) 1.dp else 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        skill.title,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                        color = if (skill.enabled) Color.Black else Color.Gray
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    SourceBadge(skill.sourceKind)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    skill.description.take(100) + if (skill.description.length > 100) "..." else "",
                    fontSize = 12.sp,
                    color = Color.Gray,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
            Switch(
                checked = skill.enabled,
                onCheckedChange = onToggle,
                colors = SwitchDefaults.colors(
                    checkedTrackColor = Color(0xFF4CAF50),
                    checkedThumbColor = Color.White
                )
            )
        }
    }
}

@Composable
private fun SourceBadge(sourceKind: SkillSourceKind) {
    val (text, color) = when (sourceKind) {
        SkillSourceKind.BUNDLED -> "Built-in" to Color(0xFF2196F3)
        SkillSourceKind.LOCAL_FILE -> "Custom" to Color(0xFFFF9800)
        SkillSourceKind.MARKDOWN_PACKAGE -> "Package" to Color(0xFF9C27B0)
    }
    Text(
        text,
        fontSize = 10.sp,
        color = color,
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(color.copy(alpha = 0.1f))
            .padding(horizontal = 6.dp, vertical = 2.dp)
    )
}

private fun getCategoryInfo(category: String): Pair<ImageVector, String> {
    return when (category.lowercase()) {
        "utility" -> Icons.Outlined.Build to "Utility"
        "development" -> Icons.Outlined.Code to "Development"
        "document" -> Icons.Outlined.Description to "Document"
        "meta" -> Icons.Outlined.Settings to "Meta"
        "productivity" -> Icons.Outlined.AutoAwesome to "Productivity"
        "memory" -> Icons.Outlined.AutoAwesome to "Memory"
        "device" -> Icons.Outlined.Extension to "Device"
        "communication" -> Icons.Outlined.Extension to "Communication"
        "automation" -> Icons.Outlined.Extension to "Automation"
        "remote" -> Icons.Outlined.Extension to "Remote"
        "knowledge" -> Icons.Outlined.Search to "Knowledge"
        else -> Icons.Outlined.Extension to category.replaceFirstChar { it.uppercase() }
    }
}
