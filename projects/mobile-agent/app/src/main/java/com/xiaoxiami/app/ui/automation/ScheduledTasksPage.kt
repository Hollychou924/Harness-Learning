package com.xiaoxiami.app.ui.automation

import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.xiaoxiami.app.data.MemoryDatabase
import com.xiaoxiami.app.data.automation.AgentScheduleEntity
import com.xiaoxiami.app.data.automation.AgentScheduleRunEntity
import com.xiaoxiami.app.data.automation.AgentScheduleRunWithName
import com.xiaoxiami.app.repository.AgentAutomationRepository
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.launch

private enum class ScheduledTasksViewMode {
    LIST,
    CREATE,
    EDIT,
    DETAIL
}

private enum class ScheduledTasksTab {
    TASKS,
    HISTORY
}

private enum class ScheduleMode {
    ONCE,
    INTERVAL,
    DAILY,
    WEEKLY
}

private data class ScheduleDraft(
    val name: String,
    val description: String,
    val prompt: String,
    val enabled: Boolean,
    val expiresAt: Long?,
    val clearExpiresAt: Boolean,
    val scheduleType: AgentAutomationRepository.ScheduleType,
    val runAt: Long? = null,
    val intervalMinutes: Int? = null,
    val hourOfDay: Int? = null,
    val minuteOfHour: Int? = null,
    val daysOfWeek: List<String> = emptyList()
)

private val dayLabels = listOf(
    "MONDAY" to "周一",
    "TUESDAY" to "周二",
    "WEDNESDAY" to "周三",
    "THURSDAY" to "周四",
    "FRIDAY" to "周五",
    "SATURDAY" to "周六",
    "SUNDAY" to "周日"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduledTasksPage(onBack: () -> Unit) {
    BackHandler(onBack = onBack)

    val context = LocalContext.current
    val repository = remember {
        AgentAutomationRepository(
            context = context.applicationContext,
            dao = MemoryDatabase.getDatabase(context.applicationContext).agentAutomationDao()
        )
    }
    val scope = rememberCoroutineScope()

    var viewMode by remember { mutableStateOf(ScheduledTasksViewMode.LIST) }
    var currentTab by remember { mutableStateOf(ScheduledTasksTab.TASKS) }
    var loading by remember { mutableStateOf(false) }
    var selectedTaskId by remember { mutableStateOf<String?>(null) }
    var deleteTarget by remember { mutableStateOf<AgentScheduleEntity?>(null) }

    var tasks by remember { mutableStateOf<List<AgentScheduleEntity>>(emptyList()) }
    var allRuns by remember { mutableStateOf<List<AgentScheduleRunWithName>>(emptyList()) }
    val runsByTask = remember { mutableStateMapOf<String, List<AgentScheduleRunEntity>>() }

    suspend fun reloadTasks() {
        loading = true
        tasks = repository.listSchedules(limit = 200)
        loading = false
    }

    suspend fun reloadAllRuns() {
        allRuns = repository.listAllRuns(limit = 100, offset = 0)
    }

    suspend fun reloadTaskRuns(taskId: String) {
        runsByTask[taskId] = repository.listRuns(taskId, limit = 30)
    }

    LaunchedEffect(Unit) {
        repository.disableExpiredSchedules()
        reloadTasks()
        reloadAllRuns()
    }

    val selectedTask = selectedTaskId?.let { id -> tasks.firstOrNull { it.id == id } }
    val showTabs = viewMode == ScheduledTasksViewMode.LIST && selectedTask == null

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF8F8F8))
    ) {
        TopAppBar(
            title = {
                Text(
                    text = "定时任务",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
            },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(imageVector = Icons.Default.ArrowBack, contentDescription = "返回")
                }
            },
            actions = {
                if (showTabs && currentTab == ScheduledTasksTab.TASKS) {
                    IconButton(onClick = { viewMode = ScheduledTasksViewMode.CREATE }) {
                        Icon(imageVector = Icons.Default.Add, contentDescription = "新建")
                    }
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
        )

        if (showTabs) {
            TabRow(selectedTabIndex = if (currentTab == ScheduledTasksTab.TASKS) 0 else 1) {
                Tab(
                    selected = currentTab == ScheduledTasksTab.TASKS,
                    onClick = { currentTab = ScheduledTasksTab.TASKS },
                    text = { Text("任务列表") }
                )
                Tab(
                    selected = currentTab == ScheduledTasksTab.HISTORY,
                    onClick = { currentTab = ScheduledTasksTab.HISTORY },
                    text = { Text("执行历史") }
                )
            }
        }

        when {
            showTabs && currentTab == ScheduledTasksTab.HISTORY -> {
                AllRunsList(allRuns = allRuns)
            }

            viewMode == ScheduledTasksViewMode.LIST -> {
                if (loading) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("加载中...", color = Color(0xFF666666))
                    }
                } else {
                    TaskList(
                        tasks = tasks,
                        onSelect = { task ->
                            selectedTaskId = task.id
                            viewMode = ScheduledTasksViewMode.DETAIL
                            scope.launch { reloadTaskRuns(task.id) }
                        },
                        onToggle = { task ->
                            scope.launch {
                                runCatching {
                                    repository.updateSchedule(
                                        scheduleId = task.id,
                                        enabled = !task.enabled
                                    )
                                }.onSuccess {
                                    reloadTasks()
                                }.onFailure {
                                    Toast.makeText(context, it.message ?: "操作失败", Toast.LENGTH_SHORT).show()
                                }
                            }
                        },
                        onRunNow = { task ->
                            scope.launch {
                                runCatching { repository.runScheduleNow(task.id) }
                                    .onSuccess {
                                        Toast.makeText(context, "已触发立即执行", Toast.LENGTH_SHORT).show()
                                        reloadTasks()
                                        reloadAllRuns()
                                        reloadTaskRuns(task.id)
                                    }
                                    .onFailure {
                                        Toast.makeText(context, it.message ?: "执行失败", Toast.LENGTH_SHORT).show()
                                    }
                            }
                        },
                        onEdit = { task ->
                            selectedTaskId = task.id
                            viewMode = ScheduledTasksViewMode.EDIT
                        },
                        onDelete = { task ->
                            deleteTarget = task
                        }
                    )
                }
            }

            viewMode == ScheduledTasksViewMode.CREATE -> {
                ScheduledTaskForm(
                    mode = ScheduleFormMode.CREATE,
                    task = null,
                    onCancel = { viewMode = ScheduledTasksViewMode.LIST },
                    onSubmit = { draft ->
                        if (draft.scheduleType == AgentAutomationRepository.ScheduleType.ONCE) {
                            repository.createOneTimeSchedule(
                                name = draft.name,
                                taskPrompt = draft.prompt,
                                runAt = draft.runAt ?: error("runAt required"),
                                description = draft.description,
                                enabled = draft.enabled,
                                expiresAt = draft.expiresAt
                            )
                        } else {
                            repository.createCronSchedule(
                                name = draft.name,
                                taskPrompt = draft.prompt,
                                scheduleType = draft.scheduleType,
                                description = draft.description,
                                intervalMinutes = draft.intervalMinutes,
                                hourOfDay = draft.hourOfDay,
                                minuteOfHour = draft.minuteOfHour,
                                daysOfWeek = draft.daysOfWeek,
                                enabled = draft.enabled,
                                expiresAt = draft.expiresAt
                            )
                        }
                        reloadTasks()
                        reloadAllRuns()
                        viewMode = ScheduledTasksViewMode.LIST
                    }
                )
            }

            viewMode == ScheduledTasksViewMode.EDIT && selectedTask != null -> {
                ScheduledTaskForm(
                    mode = ScheduleFormMode.EDIT,
                    task = selectedTask,
                    onCancel = { viewMode = ScheduledTasksViewMode.DETAIL },
                    onSubmit = { draft ->
                        repository.updateSchedule(
                            scheduleId = selectedTask.id,
                            name = draft.name,
                            taskPrompt = draft.prompt,
                            description = draft.description,
                            enabled = draft.enabled,
                            scheduleType = draft.scheduleType,
                            runAt = draft.runAt,
                            expiresAt = draft.expiresAt,
                            clearExpiresAt = draft.clearExpiresAt,
                            intervalMinutes = draft.intervalMinutes,
                            hourOfDay = draft.hourOfDay,
                            minuteOfHour = draft.minuteOfHour,
                            daysOfWeek = draft.daysOfWeek
                        )
                        reloadTasks()
                        reloadAllRuns()
                        reloadTaskRuns(selectedTask.id)
                        viewMode = ScheduledTasksViewMode.DETAIL
                    }
                )
            }

            viewMode == ScheduledTasksViewMode.DETAIL && selectedTask != null -> {
                TaskDetail(
                    task = selectedTask,
                    runs = runsByTask[selectedTask.id] ?: emptyList(),
                    onBack = {
                        selectedTaskId = null
                        viewMode = ScheduledTasksViewMode.LIST
                    },
                    onEdit = { viewMode = ScheduledTasksViewMode.EDIT },
                    onDelete = { deleteTarget = selectedTask },
                    onRunNow = {
                        scope.launch {
                            runCatching { repository.runScheduleNow(selectedTask.id) }
                                .onSuccess {
                                    Toast.makeText(context, "已触发立即执行", Toast.LENGTH_SHORT).show()
                                    reloadTasks()
                                    reloadAllRuns()
                                    reloadTaskRuns(selectedTask.id)
                                }
                                .onFailure {
                                    Toast.makeText(context, it.message ?: "执行失败", Toast.LENGTH_SHORT).show()
                                }
                        }
                    }
                )
            }
        }
    }

    if (deleteTarget != null) {
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("删除任务") },
            text = { Text("确认删除「${deleteTarget?.name ?: ""}」？此操作不可恢复。") },
            confirmButton = {
                TextButton(
                    onClick = {
                        val task = deleteTarget ?: return@TextButton
                        scope.launch {
                            runCatching { repository.deleteSchedule(task.id) }
                                .onSuccess {
                                    if (selectedTaskId == task.id) {
                                        selectedTaskId = null
                                        viewMode = ScheduledTasksViewMode.LIST
                                    }
                                    reloadTasks()
                                    reloadAllRuns()
                                    deleteTarget = null
                                }
                                .onFailure {
                                    Toast.makeText(context, it.message ?: "删除失败", Toast.LENGTH_SHORT).show()
                                }
                        }
                    }
                ) {
                    Text("删除", color = Color(0xFFE53935))
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) {
                    Text("取消")
                }
            }
        )
    }
}

@Composable
private fun TaskList(
    tasks: List<AgentScheduleEntity>,
    onSelect: (AgentScheduleEntity) -> Unit,
    onToggle: (AgentScheduleEntity) -> Unit,
    onRunNow: (AgentScheduleEntity) -> Unit,
    onEdit: (AgentScheduleEntity) -> Unit,
    onDelete: (AgentScheduleEntity) -> Unit
) {
    if (tasks.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    imageVector = Icons.Outlined.Schedule,
                    contentDescription = null,
                    tint = Color(0xFF999999),
                    modifier = Modifier.size(48.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text("暂无定时任务", color = Color(0xFF666666))
            }
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item { Spacer(modifier = Modifier.height(8.dp)) }
        items(tasks, key = { it.id }) { task ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp)
                    .clickable { onSelect(task) },
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = task.name,
                            style = MaterialTheme.typography.titleMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                        Switch(
                            checked = task.enabled,
                            onCheckedChange = { onToggle(task) }
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = formatSchedule(task),
                        color = Color(0xFF666666),
                        fontSize = 13.sp
                    )
                    Text(
                        text = "下次执行：${formatDateTime(task.nextRunAt)}",
                        color = Color(0xFF888888),
                        fontSize = 12.sp
                    )

                    Spacer(modifier = Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        IconButton(onClick = { onEdit(task) }, modifier = Modifier.size(34.dp)) {
                            Icon(Icons.Default.Edit, contentDescription = "编辑", tint = Color(0xFF666666))
                        }
                        IconButton(onClick = { onRunNow(task) }, modifier = Modifier.size(34.dp)) {
                            Icon(Icons.Default.PlayArrow, contentDescription = "立即运行", tint = Color(0xFF1565C0))
                        }
                        IconButton(onClick = { onDelete(task) }, modifier = Modifier.size(34.dp)) {
                            Icon(Icons.Default.DeleteOutline, contentDescription = "删除", tint = Color(0xFFE53935))
                        }
                    }
                }
            }
        }
        item { Spacer(modifier = Modifier.height(12.dp)) }
    }
}

@Composable
private fun TaskDetail(
    task: AgentScheduleEntity,
    runs: List<AgentScheduleRunEntity>,
    onBack: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onRunNow: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = onBack) {
                Text("返回")
            }
            Spacer(modifier = Modifier.weight(1f))
            IconButton(onClick = onEdit) {
                Icon(Icons.Default.Edit, contentDescription = "编辑")
            }
            IconButton(onClick = onRunNow) {
                Icon(Icons.Default.PlayArrow, contentDescription = "立即运行")
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.DeleteOutline, contentDescription = "删除", tint = Color(0xFFE53935))
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item { Spacer(modifier = Modifier.height(4.dp)) }

            item {
                DetailCard(title = "任务信息") {
                    Text(task.name, fontWeight = FontWeight.SemiBold)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(task.description.ifBlank { "（无描述）" }, color = Color(0xFF666666), fontSize = 13.sp)
                    Spacer(modifier = Modifier.height(10.dp))
                    Text("任务指令", fontWeight = FontWeight.Medium)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(task.taskPrompt, color = Color(0xFF333333), fontSize = 14.sp)
                }
            }

            item {
                DetailCard(title = "配置") {
                    Text("执行计划：${formatSchedule(task)}", fontSize = 13.sp)
                    Text("状态：${if (task.enabled) "已启用" else "已禁用"}", fontSize = 13.sp)
                    Text("下次执行：${formatDateTime(task.nextRunAt)}", fontSize = 13.sp)
                    Text("上次执行：${formatDateTime(task.lastRunAt)}", fontSize = 13.sp)
                    if (task.lastStatus.isNotBlank()) {
                        Text("最近状态：${task.lastStatus}", fontSize = 13.sp)
                    }
                    if (task.lastError.isNotBlank()) {
                        Text("最近错误：${task.lastError}", fontSize = 13.sp, color = Color(0xFFE53935))
                    }
                }
            }

            item {
                DetailCard(title = "执行历史") {
                    if (runs.isEmpty()) {
                        Text("暂无执行记录", color = Color(0xFF888888), fontSize = 13.sp)
                    } else {
                        runs.forEachIndexed { index, run ->
                            if (index > 0) {
                                Divider(modifier = Modifier.padding(vertical = 8.dp), color = Color(0xFFEEEEEE))
                            }
                            RunRow(
                                title = formatDateTime(run.startedAt),
                                status = run.status,
                                detail = "${run.triggerSource} · ${run.summary.ifBlank { "无摘要" }}"
                            )
                        }
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(12.dp)) }
        }
    }
}

@Composable
private fun AllRunsList(allRuns: List<AgentScheduleRunWithName>) {
    if (allRuns.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    imageVector = Icons.Outlined.History,
                    contentDescription = null,
                    tint = Color(0xFF999999),
                    modifier = Modifier.size(48.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text("暂无执行记录", color = Color(0xFF666666))
            }
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item { Spacer(modifier = Modifier.height(8.dp)) }
        items(allRuns, key = { it.id }) { run ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    RunRow(
                        title = run.scheduleName.ifBlank { "(已删除任务)" },
                        status = run.status,
                        detail = "${formatDateTime(run.startedAt)} · ${run.summary.ifBlank { "无摘要" }}"
                    )
                }
            }
        }
        item { Spacer(modifier = Modifier.height(12.dp)) }
    }
}

@Composable
private fun RunRow(title: String, status: String, detail: String) {
    val statusColor = when (status.uppercase()) {
        "SUCCESS" -> Color(0xFF2E7D32)
        "RUNNING" -> Color(0xFF1565C0)
        else -> Color(0xFFE53935)
    }

    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(title, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
            Text(status, color = statusColor, fontSize = 12.sp)
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(detail, color = Color(0xFF666666), fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun DetailCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Spacer(modifier = Modifier.height(8.dp))
            content()
        }
    }
}

private enum class ScheduleFormMode {
    CREATE,
    EDIT
}

@Composable
private fun ScheduledTaskForm(
    mode: ScheduleFormMode,
    task: AgentScheduleEntity?,
    onCancel: () -> Unit,
    onSubmit: suspend (ScheduleDraft) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val initialMode = remember(task?.id) {
        when (task?.scheduleType) {
            AgentAutomationRepository.ScheduleType.ONCE.name -> ScheduleMode.ONCE
            AgentAutomationRepository.ScheduleType.DAILY.name -> ScheduleMode.DAILY
            AgentAutomationRepository.ScheduleType.WEEKLY.name -> ScheduleMode.WEEKLY
            else -> ScheduleMode.INTERVAL
        }
    }

    var name by remember(task?.id) { mutableStateOf(task?.name.orEmpty()) }
    var description by remember(task?.id) { mutableStateOf(task?.description.orEmpty()) }
    var prompt by remember(task?.id) { mutableStateOf(task?.taskPrompt.orEmpty()) }
    var enabled by remember(task?.id) { mutableStateOf(task?.enabled ?: true) }
    var expiresAtText by remember(task?.id) {
        mutableStateOf(
            task?.expiresAt?.let { ms ->
                Instant.ofEpochMilli(ms)
                    .atZone(ZoneId.systemDefault())
                    .toLocalDate()
                    .toString()
            }.orEmpty()
        )
    }

    var scheduleMode by remember(task?.id) { mutableStateOf(initialMode) }
    var onceDate by remember(task?.id) {
        mutableStateOf(
            task?.runAt?.let { ms ->
                Instant.ofEpochMilli(ms)
                    .atZone(ZoneId.systemDefault())
                    .toLocalDate()
                    .toString()
            }.orEmpty()
        )
    }
    var onceTime by remember(task?.id) {
        mutableStateOf(
            task?.runAt?.let { ms ->
                Instant.ofEpochMilli(ms)
                    .atZone(ZoneId.systemDefault())
                    .toLocalTime()
                    .format(DateTimeFormatter.ofPattern("HH:mm"))
            }.orEmpty()
        )
    }
    var intervalMinutesText by remember(task?.id) { mutableStateOf((task?.intervalMinutes ?: 60).toString()) }
    var dailyTime by remember(task?.id) {
        mutableStateOf(
            if (task?.hourOfDay != null && task.minuteOfHour != null) {
                "%02d:%02d".format(task.hourOfDay, task.minuteOfHour)
            } else {
                "09:00"
            }
        )
    }

    val weeklyDays = remember(task?.id) {
        mutableStateListOf<String>().apply {
            addAll(task?.daysOfWeek?.split(",")?.map { it.trim() }?.filter { it.isNotBlank() } ?: emptyList())
            if (isEmpty() && task == null) {
                add("MONDAY")
            }
        }
    }

    var saving by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { Spacer(modifier = Modifier.height(8.dp)) }

        item {
            DetailCard(title = if (mode == ScheduleFormMode.CREATE) "新建任务" else "编辑任务") {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("任务名称") },
                    singleLine = true
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("任务说明（可选）") },
                    singleLine = true
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = prompt,
                    onValueChange = { prompt = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(132.dp),
                    label = { Text("任务指令") }
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("启用任务", modifier = Modifier.weight(1f))
                    Switch(checked = enabled, onCheckedChange = { enabled = it })
                }
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = expiresAtText,
                    onValueChange = { expiresAtText = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("过期日期（YYYY-MM-DD，可选）") },
                    singleLine = true
                )
            }
        }

        item {
            DetailCard(title = "执行计划") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(
                        ScheduleMode.ONCE to "单次",
                        ScheduleMode.INTERVAL to "间隔",
                        ScheduleMode.DAILY to "每天",
                        ScheduleMode.WEEKLY to "每周"
                    ).forEach { (modeItem, label) ->
                        Button(
                            onClick = { scheduleMode = modeItem },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(
                                text = label,
                                color = if (scheduleMode == modeItem) Color.White else Color(0xFF444444)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                when (scheduleMode) {
                    ScheduleMode.ONCE -> {
                        OutlinedTextField(
                            value = onceDate,
                            onValueChange = { onceDate = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("日期（YYYY-MM-DD）") },
                            singleLine = true
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = onceTime,
                            onValueChange = { onceTime = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("时间（HH:mm）") },
                            singleLine = true
                        )
                    }

                    ScheduleMode.INTERVAL -> {
                        OutlinedTextField(
                            value = intervalMinutesText,
                            onValueChange = { intervalMinutesText = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("间隔分钟（>=5）") },
                            singleLine = true
                        )
                    }

                    ScheduleMode.DAILY -> {
                        OutlinedTextField(
                            value = dailyTime,
                            onValueChange = { dailyTime = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("每日时间（HH:mm）") },
                            singleLine = true
                        )
                    }

                    ScheduleMode.WEEKLY -> {
                        OutlinedTextField(
                            value = dailyTime,
                            onValueChange = { dailyTime = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("每周时间（HH:mm）") },
                            singleLine = true
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("执行星期", fontSize = 13.sp, color = Color(0xFF666666))
                        Spacer(modifier = Modifier.height(6.dp))
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            dayLabels.chunked(3).forEach { rowDays ->
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    rowDays.forEach { (value, label) ->
                                        val selected = weeklyDays.contains(value)
                                        Box(
                                            modifier = Modifier
                                                .weight(1f)
                                                .background(
                                                    color = if (selected) Color(0xFF1565C0) else Color(0xFFEDEDED),
                                                    shape = RoundedCornerShape(8.dp)
                                                )
                                                .clickable {
                                                    if (selected) weeklyDays.remove(value) else weeklyDays.add(value)
                                                }
                                                .padding(vertical = 8.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = label,
                                                color = if (selected) Color.White else Color(0xFF555555),
                                                fontSize = 13.sp
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(onClick = onCancel, enabled = !saving) {
                    Text("取消")
                }
                Spacer(modifier = Modifier.width(8.dp))
                Button(
                    onClick = {
                        if (saving) return@Button
                        val draft = buildDraft(
                            name = name,
                            description = description,
                            prompt = prompt,
                            enabled = enabled,
                            expiresAtText = expiresAtText,
                            scheduleMode = scheduleMode,
                            onceDate = onceDate,
                            onceTime = onceTime,
                            intervalMinutesText = intervalMinutesText,
                            dailyTime = dailyTime,
                            weeklyDays = weeklyDays.toList(),
                            isCreate = mode == ScheduleFormMode.CREATE
                        )
                        if (draft == null) {
                            Toast.makeText(context, "请检查表单：时间/日期格式或必填项", Toast.LENGTH_SHORT).show()
                            return@Button
                        }
                        saving = true
                        scope.launch {
                            runCatching { onSubmit(draft) }
                                .onSuccess {
                                    Toast.makeText(context, "保存成功", Toast.LENGTH_SHORT).show()
                                }
                                .onFailure {
                                    Toast.makeText(context, it.message ?: "保存失败", Toast.LENGTH_SHORT).show()
                                }
                            saving = false
                        }
                    },
                    enabled = !saving
                ) {
                    Text(if (saving) "保存中..." else "保存")
                }
            }
        }

        item { Spacer(modifier = Modifier.height(12.dp)) }
    }
}

private fun buildDraft(
    name: String,
    description: String,
    prompt: String,
    enabled: Boolean,
    expiresAtText: String,
    scheduleMode: ScheduleMode,
    onceDate: String,
    onceTime: String,
    intervalMinutesText: String,
    dailyTime: String,
    weeklyDays: List<String>,
    isCreate: Boolean
): ScheduleDraft? {
    if (name.isBlank() || prompt.isBlank()) return null

    val expiresAtParsed = parseDateAtStartOfDay(expiresAtText.trim())
    if (expiresAtText.isNotBlank() && expiresAtParsed == null) return null

    return when (scheduleMode) {
        ScheduleMode.ONCE -> {
            val runAt = parseDateTime(onceDate.trim(), onceTime.trim()) ?: return null
            if (isCreate && runAt <= System.currentTimeMillis()) return null
            ScheduleDraft(
                name = name.trim(),
                description = description.trim(),
                prompt = prompt.trim(),
                enabled = enabled,
                expiresAt = expiresAtParsed,
                clearExpiresAt = expiresAtText.isBlank(),
                scheduleType = AgentAutomationRepository.ScheduleType.ONCE,
                runAt = runAt
            )
        }

        ScheduleMode.INTERVAL -> {
            val interval = intervalMinutesText.trim().toIntOrNull() ?: return null
            if (interval < 5) return null
            ScheduleDraft(
                name = name.trim(),
                description = description.trim(),
                prompt = prompt.trim(),
                enabled = enabled,
                expiresAt = expiresAtParsed,
                clearExpiresAt = expiresAtText.isBlank(),
                scheduleType = AgentAutomationRepository.ScheduleType.INTERVAL,
                intervalMinutes = interval
            )
        }

        ScheduleMode.DAILY -> {
            val hm = parseHourMinute(dailyTime.trim()) ?: return null
            ScheduleDraft(
                name = name.trim(),
                description = description.trim(),
                prompt = prompt.trim(),
                enabled = enabled,
                expiresAt = expiresAtParsed,
                clearExpiresAt = expiresAtText.isBlank(),
                scheduleType = AgentAutomationRepository.ScheduleType.DAILY,
                hourOfDay = hm.first,
                minuteOfHour = hm.second
            )
        }

        ScheduleMode.WEEKLY -> {
            val hm = parseHourMinute(dailyTime.trim()) ?: return null
            if (weeklyDays.isEmpty()) return null
            ScheduleDraft(
                name = name.trim(),
                description = description.trim(),
                prompt = prompt.trim(),
                enabled = enabled,
                expiresAt = expiresAtParsed,
                clearExpiresAt = expiresAtText.isBlank(),
                scheduleType = AgentAutomationRepository.ScheduleType.WEEKLY,
                hourOfDay = hm.first,
                minuteOfHour = hm.second,
                daysOfWeek = weeklyDays
            )
        }
    }
}

private fun parseDateTime(dateText: String, timeText: String): Long? {
    return runCatching {
        val date = LocalDate.parse(dateText, DateTimeFormatter.ISO_LOCAL_DATE)
        val hm = parseHourMinute(timeText) ?: return null
        LocalDateTime.of(date.year, date.month, date.dayOfMonth, hm.first, hm.second)
            .atZone(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli()
    }.getOrNull()
}

private fun parseDateAtStartOfDay(dateText: String): Long? {
    if (dateText.isBlank()) return null
    return runCatching {
        LocalDate.parse(dateText, DateTimeFormatter.ISO_LOCAL_DATE)
            .atStartOfDay(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli()
    }.getOrNull()
}

private fun parseHourMinute(text: String): Pair<Int, Int>? {
    val parts = text.split(":")
    if (parts.size != 2) return null
    val hour = parts[0].toIntOrNull() ?: return null
    val minute = parts[1].toIntOrNull() ?: return null
    if (hour !in 0..23 || minute !in 0..59) return null
    return hour to minute
}

private fun formatSchedule(task: AgentScheduleEntity): String {
    return when (task.scheduleType) {
        AgentAutomationRepository.ScheduleType.ONCE.name -> {
            "单次 · ${formatDateTime(task.runAt)}"
        }
        AgentAutomationRepository.ScheduleType.INTERVAL.name -> {
            "每 ${task.intervalMinutes ?: 60} 分钟"
        }
        AgentAutomationRepository.ScheduleType.DAILY.name -> {
            val hour = task.hourOfDay ?: 0
            val minute = task.minuteOfHour ?: 0
            "每天 · %02d:%02d".format(hour, minute)
        }
        AgentAutomationRepository.ScheduleType.WEEKLY.name -> {
            val dayText = task.daysOfWeek.split(",")
                .mapNotNull { raw -> dayLabels.firstOrNull { it.first == raw.trim() }?.second }
                .joinToString("、")
                .ifBlank { "未设置" }
            val hour = task.hourOfDay ?: 0
            val minute = task.minuteOfHour ?: 0
            "每周($dayText) · %02d:%02d".format(hour, minute)
        }
        else -> "未知"
    }
}

private fun formatDateTime(epochMs: Long?): String {
    if (epochMs == null || epochMs <= 0L) return "-"
    return runCatching {
        Instant.ofEpochMilli(epochMs)
            .atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
    }.getOrElse { "-" }
}
