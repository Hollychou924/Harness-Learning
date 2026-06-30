package com.xiaoxiami.app.agent.tools

import android.content.ContentProviderOperation
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.provider.CalendarContract
import android.provider.ContactsContract
import com.xiaoxiami.app.agent.Tool
import com.xiaoxiami.app.agent.ToolAccessKind
import com.xiaoxiami.app.agent.ToolAccessRequirement
import com.xiaoxiami.app.agent.ToolContext
import com.xiaoxiami.app.agent.ToolFieldSchema
import com.xiaoxiami.app.agent.ToolHostKind
import com.xiaoxiami.app.agent.ToolParameterSchema
import com.xiaoxiami.app.agent.ToolResult
import com.xiaoxiami.app.agent.ToolRiskLevel
import com.xiaoxiami.app.agent.ToolSchema
import com.xiaoxiami.app.agent.ToolValueType
import java.util.TimeZone

internal fun contactReadRequirement() = listOf(
    ToolAccessRequirement(
        kind = ToolAccessKind.ANDROID_PERMISSION,
        identifier = android.Manifest.permission.READ_CONTACTS,
        description = "Read device contacts."
    )
)

internal fun contactWriteRequirement() = listOf(
    ToolAccessRequirement(
        kind = ToolAccessKind.ANDROID_PERMISSION,
        identifier = android.Manifest.permission.WRITE_CONTACTS,
        description = "Create or modify contacts."
    )
)

internal fun calendarReadRequirement() = listOf(
    ToolAccessRequirement(
        kind = ToolAccessKind.ANDROID_PERMISSION,
        identifier = android.Manifest.permission.READ_CALENDAR,
        description = "Read calendar events."
    )
)

internal fun calendarWriteRequirement() = listOf(
    ToolAccessRequirement(
        kind = ToolAccessKind.ANDROID_PERMISSION,
        identifier = android.Manifest.permission.WRITE_CALENDAR,
        description = "Create or modify calendar events."
    )
)

private fun readContactRecord(context: Context, contactId: Long): Map<String, Any?> {
    val phones = mutableListOf<String>()
    val emails = mutableListOf<String>()
    var displayName = ""
    var company = ""

    context.contentResolver.query(
        ContactsContract.Data.CONTENT_URI,
        arrayOf(
            ContactsContract.Data.MIMETYPE,
            ContactsContract.Data.DATA1,
            ContactsContract.Data.DATA2,
            ContactsContract.Data.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Organization.COMPANY
        ),
        "${ContactsContract.Data.CONTACT_ID} = ?",
        arrayOf(contactId.toString()),
        null
    )?.use { cursor ->
        while (cursor.moveToNext()) {
            val mimeType = cursor.getString(0).orEmpty()
            val data1 = cursor.getString(1).orEmpty()
            displayName = cursor.getString(3).orEmpty().ifBlank { displayName }
            when (mimeType) {
                ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE -> if (data1.isNotBlank()) phones += data1
                ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE -> if (data1.isNotBlank()) emails += data1
                ContactsContract.CommonDataKinds.Organization.CONTENT_ITEM_TYPE -> {
                    company = cursor.getString(4).orEmpty()
                }
            }
        }
    }

    return mapOf(
        "contactId" to contactId,
        "displayName" to displayName,
        "phones" to phones.distinct(),
        "emails" to emails.distinct(),
        "company" to company
    )
}

private fun parseCalendarId(arguments: Map<String, Any?>): Long? {
    val raw = arguments["calendarId"] ?: return null
    return when (raw) {
        is Number -> raw.toLong()
        is String -> raw.toLongOrNull()
        else -> null
    }
}

private fun queryDefaultCalendarId(context: Context): Long? {
    context.contentResolver.query(
        CalendarContract.Calendars.CONTENT_URI,
        arrayOf(CalendarContract.Calendars._ID),
        "${CalendarContract.Calendars.VISIBLE} = 1",
        null,
        "${CalendarContract.Calendars.IS_PRIMARY} DESC, ${CalendarContract.Calendars._ID} ASC"
    )?.use { cursor ->
        if (cursor.moveToFirst()) {
            return cursor.getLong(0)
        }
    }
    return null
}

class ReadCalendarTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "read_calendar",
        description = "Read calendar events in a time range.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("calendar", "pim", "read"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        accessRequirements = calendarReadRequirement(),
        inputSchema = listOf(
            ToolParameterSchema("startAt", ToolValueType.NUMBER, "Start timestamp in epoch milliseconds.", required = true),
            ToolParameterSchema("endAt", ToolValueType.NUMBER, "End timestamp in epoch milliseconds.", required = true),
            ToolParameterSchema("keywords", ToolValueType.STRING, "Optional keyword filter.", required = false),
            ToolParameterSchema("calendarIds", ToolValueType.ARRAY, "Optional calendar id list.", required = false, itemType = ToolValueType.STRING)
        ),
        outputSchema = listOf(
            ToolFieldSchema("events", ToolValueType.ARRAY, "Calendar events in the range.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val startAt = arguments.longArg("startAt")
        val endAt = arguments.longArg("endAt")
        if (startAt <= 0L || endAt <= 0L || endAt < startAt) {
            return ToolResult(false, "", "startAt/endAt 不合法")
        }
        val keywords = arguments.stringArg("keywords").lowercase()
        val calendarIds = arguments.stringListArg("calendarIds").toSet()
        val builder = CalendarContract.Instances.CONTENT_URI.buildUpon().apply {
            ContentUris.appendId(this, startAt)
            ContentUris.appendId(this, endAt)
        }
        val events = mutableListOf<Map<String, Any?>>()
        this.context.contentResolver.query(
            builder.build(),
            arrayOf(
                CalendarContract.Instances.EVENT_ID,
                CalendarContract.Instances.TITLE,
                CalendarContract.Instances.BEGIN,
                CalendarContract.Instances.END,
                CalendarContract.Instances.EVENT_LOCATION,
                CalendarContract.Instances.DESCRIPTION,
                CalendarContract.Instances.CALENDAR_ID
            ),
            null,
            null,
            "${CalendarContract.Instances.BEGIN} ASC"
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val calendarId = cursor.getLong(6).toString()
                if (calendarIds.isNotEmpty() && !calendarIds.contains(calendarId)) continue
                val title = cursor.getString(1).orEmpty()
                val location = cursor.getString(4).orEmpty()
                val description = cursor.getString(5).orEmpty()
                val haystack = "$title $location $description".lowercase()
                if (keywords.isNotBlank() && !haystack.contains(keywords)) continue
                events += mapOf(
                    "eventId" to cursor.getLong(0),
                    "title" to title,
                    "startAt" to cursor.getLong(2),
                    "endAt" to cursor.getLong(3),
                    "location" to location,
                    "notes" to description,
                    "calendarId" to cursor.getLong(6)
                )
            }
        }
        return ToolResult(true, jsonOutput(mapOf("events" to events)))
    }
}

class CreateCalendarEventTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "create_calendar_event",
        description = "Create a calendar event.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("calendar", "pim", "write"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = calendarWriteRequirement() + calendarReadRequirement(),
        approvalRequired = true,
        approvalReason = "创建日程会修改用户日历数据。",
        approvalSummary = "Agent 请求创建日程",
        inputSchema = listOf(
            ToolParameterSchema("title", ToolValueType.STRING, "Event title.", required = true),
            ToolParameterSchema("startAt", ToolValueType.NUMBER, "Start timestamp in epoch milliseconds.", required = true),
            ToolParameterSchema("endAt", ToolValueType.NUMBER, "End timestamp in epoch milliseconds.", required = true),
            ToolParameterSchema("location", ToolValueType.STRING, "Optional location.", required = false),
            ToolParameterSchema("notes", ToolValueType.STRING, "Optional notes.", required = false),
            ToolParameterSchema("reminderMinutes", ToolValueType.INTEGER, "Optional reminder minutes before.", required = false),
            ToolParameterSchema("calendarId", ToolValueType.NUMBER, "Optional calendar id override.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("eventId", ToolValueType.NUMBER, "Created event id."),
            ToolFieldSchema("created", ToolValueType.BOOLEAN, "Whether creation succeeded.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val title = arguments.stringArg("title")
        val startAt = arguments.longArg("startAt")
        val endAt = arguments.longArg("endAt")
        val calendarId = parseCalendarId(arguments) ?: queryDefaultCalendarId(this.context)
        if (title.isBlank() || startAt <= 0L || endAt <= 0L || calendarId == null) {
            return ToolResult(false, "", "title/startAt/endAt/calendarId 不完整")
        }
        val values = ContentValues().apply {
            put(CalendarContract.Events.CALENDAR_ID, calendarId)
            put(CalendarContract.Events.TITLE, title)
            put(CalendarContract.Events.DTSTART, startAt)
            put(CalendarContract.Events.DTEND, endAt)
            put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
            put(CalendarContract.Events.EVENT_LOCATION, arguments.stringArg("location"))
            put(CalendarContract.Events.DESCRIPTION, arguments.stringArg("notes"))
        }
        val eventUri = this.context.contentResolver.insert(CalendarContract.Events.CONTENT_URI, values)
            ?: return ToolResult(false, "", "创建日程失败")
        val eventId = eventUri.lastPathSegment?.toLongOrNull()
        val reminderMinutes = arguments.intArg("reminderMinutes", -1)
        if (eventId != null && reminderMinutes >= 0) {
            val reminderValues = ContentValues().apply {
                put(CalendarContract.Reminders.EVENT_ID, eventId)
                put(CalendarContract.Reminders.MINUTES, reminderMinutes)
                put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT)
            }
            this.context.contentResolver.insert(CalendarContract.Reminders.CONTENT_URI, reminderValues)
        }
        return ToolResult(true, jsonOutput(mapOf("eventId" to eventId, "created" to true, "calendarId" to calendarId)))
    }
}

class SearchContactsTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "search_contacts",
        description = "Search contacts by display name or phone number.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("contacts", "pim", "read"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        accessRequirements = contactReadRequirement(),
        inputSchema = listOf(
            ToolParameterSchema("query", ToolValueType.STRING, "Name, company, email, or phone fragment. Leave empty to browse recent contacts.", required = false),
            ToolParameterSchema("limit", ToolValueType.INTEGER, "Maximum contacts to return.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("contacts", ToolValueType.ARRAY, "Matched contacts.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val query = arguments.stringArg("query")
        val limit = arguments.intArg("limit", 10).coerceIn(1, 50)
        val matchedIds = linkedSetOf<Long>()
        if (query.isBlank()) {
            // 空 query：返回最近更新的联系人
            this.context.contentResolver.query(
                ContactsContract.Contacts.CONTENT_URI,
                arrayOf(ContactsContract.Contacts._ID),
                null,
                null,
                "${ContactsContract.Contacts.CONTACT_LAST_UPDATED_TIMESTAMP} DESC"
            )?.use { cursor ->
                while (cursor.moveToNext() && matchedIds.size < limit) {
                    matchedIds += cursor.getLong(0)
                }
            }
        } else {
            this.context.contentResolver.query(
                ContactsContract.Data.CONTENT_URI,
                arrayOf(ContactsContract.Data.CONTACT_ID, ContactsContract.Data.DISPLAY_NAME, ContactsContract.Data.DATA1),
                "${ContactsContract.Data.DISPLAY_NAME} LIKE ? OR ${ContactsContract.Data.DATA1} LIKE ?",
                arrayOf("%$query%", "%$query%"),
                "${ContactsContract.Data.DISPLAY_NAME} ASC"
            )?.use { cursor ->
                while (cursor.moveToNext() && matchedIds.size < limit) {
                    matchedIds += cursor.getLong(0)
                }
            }
        }
        val contacts = matchedIds.take(limit).map { contactId ->
            readContactRecord(this.context, contactId)
        }
        return ToolResult(true, jsonOutput(mapOf("contacts" to contacts)))
    }
}

class GetContactDetailTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "get_contact_detail",
        description = "Read detailed contact fields by contact id.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("contacts", "pim", "read"),
        riskLevel = ToolRiskLevel.SENSITIVE,
        accessRequirements = contactReadRequirement(),
        inputSchema = listOf(
            ToolParameterSchema("contactId", ToolValueType.NUMBER, "Target contact id.", required = true)
        ),
        outputSchema = listOf(
            ToolFieldSchema("contact", ToolValueType.OBJECT, "Contact detail object.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val contactId = arguments.longArg("contactId")
        if (contactId <= 0L) return ToolResult(false, "", "contactId 不合法")
        val contact = readContactRecord(this.context, contactId)
        return ToolResult(true, jsonOutput(mapOf("contact" to contact)))
    }
}

class CreateContactTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "create_contact",
        description = "Create a new contact.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("contacts", "pim", "write"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = contactWriteRequirement(),
        approvalRequired = true,
        approvalReason = "新建联系人会修改用户通讯录。",
        approvalSummary = "Agent 请求创建联系人",
        inputSchema = listOf(
            ToolParameterSchema("name", ToolValueType.STRING, "Contact display name.", required = true),
            ToolParameterSchema("phones", ToolValueType.ARRAY, "Phone numbers.", required = false, itemType = ToolValueType.STRING),
            ToolParameterSchema("emails", ToolValueType.ARRAY, "Email addresses.", required = false, itemType = ToolValueType.STRING),
            ToolParameterSchema("company", ToolValueType.STRING, "Optional company.", required = false)
        ),
        outputSchema = listOf(
            ToolFieldSchema("contactId", ToolValueType.NUMBER, "Created contact id."),
            ToolFieldSchema("created", ToolValueType.BOOLEAN, "Whether creation succeeded.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val name = arguments.stringArg("name")
        if (name.isBlank()) return ToolResult(false, "", "name 不能为空")
        val phones = arguments.stringListArg("phones")
        val emails = arguments.stringListArg("emails")
        val company = arguments.stringArg("company")

        val ops = arrayListOf<ContentProviderOperation>()
        ops += ContentProviderOperation.newInsert(ContactsContract.RawContacts.CONTENT_URI)
            .withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, null)
            .withValue(ContactsContract.RawContacts.ACCOUNT_NAME, null)
            .build()
        ops += ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
            .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
            .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
            .withValue(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, name)
            .build()
        phones.forEach { phone ->
            ops += ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                .withValue(ContactsContract.CommonDataKinds.Phone.NUMBER, phone)
                .withValue(ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE)
                .build()
        }
        emails.forEach { email ->
            ops += ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE)
                .withValue(ContactsContract.CommonDataKinds.Email.ADDRESS, email)
                .withValue(ContactsContract.CommonDataKinds.Email.TYPE, ContactsContract.CommonDataKinds.Email.TYPE_WORK)
                .build()
        }
        if (company.isNotBlank()) {
            ops += ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Organization.CONTENT_ITEM_TYPE)
                .withValue(ContactsContract.CommonDataKinds.Organization.COMPANY, company)
                .build()
        }
        val result = this.context.contentResolver.applyBatch(ContactsContract.AUTHORITY, ops)
        val rawContactId = result.firstOrNull()?.uri?.lastPathSegment?.toLongOrNull()
        return ToolResult(true, jsonOutput(mapOf("contactId" to rawContactId, "created" to true)))
    }
}

class UpdateContactTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "update_contact",
        description = "Update name, phones, emails, or company for an existing contact.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("contacts", "pim", "write"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = contactWriteRequirement() + contactReadRequirement(),
        approvalRequired = true,
        approvalReason = "更新联系人会修改用户通讯录。",
        approvalSummary = "Agent 请求更新联系人",
        inputSchema = listOf(
            ToolParameterSchema("contactId", ToolValueType.NUMBER, "Target contact id.", required = true),
            ToolParameterSchema("patch", ToolValueType.OBJECT, "Patch object with name, phones, emails, company.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val contactId = arguments.longArg("contactId")
        @Suppress("UNCHECKED_CAST")
        val patch = arguments["patch"] as? Map<String, Any?> ?: emptyMap()
        if (contactId <= 0L || patch.isEmpty()) return ToolResult(false, "", "contactId/patch 不合法")

        val resolver = this.context.contentResolver
        patch["name"]?.toString()?.takeIf { it.isNotBlank() }?.let { name ->
            val values = ContentValues().apply {
                put(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, name)
            }
            resolver.update(
                ContactsContract.Data.CONTENT_URI,
                values,
                "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?",
                arrayOf(contactId.toString(), ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
            )
        }

        if (patch["phones"] is List<*>) {
            resolver.delete(
                ContactsContract.Data.CONTENT_URI,
                "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?",
                arrayOf(contactId.toString(), ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
            )
            val rawContactId = queryRawContactId(resolver, contactId) ?: return ToolResult(false, "", "无法定位 RawContact")
            (patch["phones"] as? List<*>)?.mapNotNull { it?.toString()?.trim() }?.filter { it.isNotBlank() }?.forEach { phone ->
                val values = ContentValues().apply {
                    put(ContactsContract.Data.RAW_CONTACT_ID, rawContactId)
                    put(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                    put(ContactsContract.CommonDataKinds.Phone.NUMBER, phone)
                    put(ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE)
                }
                resolver.insert(ContactsContract.Data.CONTENT_URI, values)
            }
        }

        if (patch["emails"] is List<*>) {
            resolver.delete(
                ContactsContract.Data.CONTENT_URI,
                "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?",
                arrayOf(contactId.toString(), ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE)
            )
            val rawContactId = queryRawContactId(resolver, contactId) ?: return ToolResult(false, "", "无法定位 RawContact")
            (patch["emails"] as? List<*>)?.mapNotNull { it?.toString()?.trim() }?.filter { it.isNotBlank() }?.forEach { email ->
                val values = ContentValues().apply {
                    put(ContactsContract.Data.RAW_CONTACT_ID, rawContactId)
                    put(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE)
                    put(ContactsContract.CommonDataKinds.Email.ADDRESS, email)
                    put(ContactsContract.CommonDataKinds.Email.TYPE, ContactsContract.CommonDataKinds.Email.TYPE_WORK)
                }
                resolver.insert(ContactsContract.Data.CONTENT_URI, values)
            }
        }

        patch["company"]?.toString()?.let { company ->
            resolver.delete(
                ContactsContract.Data.CONTENT_URI,
                "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?",
                arrayOf(contactId.toString(), ContactsContract.CommonDataKinds.Organization.CONTENT_ITEM_TYPE)
            )
            if (company.isNotBlank()) {
                val rawContactId = queryRawContactId(resolver, contactId) ?: return ToolResult(false, "", "无法定位 RawContact")
                val values = ContentValues().apply {
                    put(ContactsContract.Data.RAW_CONTACT_ID, rawContactId)
                    put(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Organization.CONTENT_ITEM_TYPE)
                    put(ContactsContract.CommonDataKinds.Organization.COMPANY, company)
                }
                resolver.insert(ContactsContract.Data.CONTENT_URI, values)
            }
        }

        return ToolResult(true, jsonOutput(mapOf("success" to true, "contactId" to contactId)))
    }

    private fun queryRawContactId(resolver: android.content.ContentResolver, contactId: Long): Long? {
        resolver.query(
            ContactsContract.RawContacts.CONTENT_URI,
            arrayOf(ContactsContract.RawContacts._ID),
            "${ContactsContract.RawContacts.CONTACT_ID} = ?",
            arrayOf(contactId.toString()),
            null
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                return cursor.getLong(0)
            }
        }
        return null
    }
}

class DeleteContactConfirmedTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "delete_contact_confirmed",
        description = "Delete a contact by contact id.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("contacts", "pim", "write"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = contactWriteRequirement(),
        approvalRequired = true,
        approvalReason = "删除联系人会修改用户通讯录。",
        approvalSummary = "Agent 请求删除联系人",
        inputSchema = listOf(
            ToolParameterSchema("contactId", ToolValueType.NUMBER, "Target contact id.", required = true)
        ),
        outputSchema = successSchema()
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val contactId = arguments.longArg("contactId")
        if (contactId <= 0L) return ToolResult(false, "", "contactId 不合法")
        val rows = this.context.contentResolver.delete(
            ContactsContract.RawContacts.CONTENT_URI,
            "${ContactsContract.RawContacts.CONTACT_ID} = ?",
            arrayOf(contactId.toString())
        )
        return ToolResult(true, jsonOutput(mapOf("success" to (rows > 0), "deletedRows" to rows)))
    }
}

class BulkCalendarImportConfirmedTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "bulk_calendar_import_confirmed",
        description = "Create multiple calendar events in one run.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("calendar", "pim", "bulk_write"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = calendarWriteRequirement() + calendarReadRequirement(),
        approvalRequired = true,
        approvalReason = "批量写入会修改用户日历数据。",
        approvalSummary = "Agent 请求批量创建日程",
        inputSchema = listOf(
            ToolParameterSchema("events", ToolValueType.ARRAY, "Event list containing title/startAt/endAt and optional location/notes.", required = true, itemType = ToolValueType.OBJECT)
        ),
        outputSchema = listOf(
            ToolFieldSchema("createdCount", ToolValueType.INTEGER, "Created event count."),
            ToolFieldSchema("failedCount", ToolValueType.INTEGER, "Failed event count.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val events = arguments.mapListArg("events")
        if (events.isEmpty()) return ToolResult(false, "", "events 不能为空")
        val calendarId = queryDefaultCalendarId(this.context) ?: return ToolResult(false, "", "未找到可写日历")
        var created = 0
        var failed = 0
        events.forEach { event ->
            val values = ContentValues().apply {
                put(CalendarContract.Events.CALENDAR_ID, calendarId)
                put(CalendarContract.Events.TITLE, event["title"]?.toString().orEmpty())
                put(CalendarContract.Events.DTSTART, anyToEpochMs(event["startAt"]))
                put(CalendarContract.Events.DTEND, anyToEpochMs(event["endAt"]))
                put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
                put(CalendarContract.Events.EVENT_LOCATION, event["location"]?.toString())
                put(CalendarContract.Events.DESCRIPTION, event["notes"]?.toString())
            }
            val uri = runCatching {
                this.context.contentResolver.insert(CalendarContract.Events.CONTENT_URI, values)
            }.getOrNull()
            if (uri != null) created++ else failed++
        }
        return ToolResult(true, jsonOutput(mapOf("createdCount" to created, "failedCount" to failed)))
    }
}

class BulkContactImportConfirmedTool(
    private val context: Context
) : Tool {
    override val schema = ToolSchema(
        name = "bulk_contact_import_confirmed",
        description = "Create multiple contacts in one run.",
        hostKind = ToolHostKind.LOCAL_ANDROID,
        capabilities = listOf("contacts", "pim", "bulk_write"),
        riskLevel = ToolRiskLevel.HIGH,
        accessRequirements = contactWriteRequirement(),
        approvalRequired = true,
        approvalReason = "批量导入联系人会修改用户通讯录。",
        approvalSummary = "Agent 请求批量导入联系人",
        inputSchema = listOf(
            ToolParameterSchema("contacts", ToolValueType.ARRAY, "Contact list with name and optional phones/emails/company.", required = true, itemType = ToolValueType.OBJECT)
        ),
        outputSchema = listOf(
            ToolFieldSchema("createdCount", ToolValueType.INTEGER, "Created contact count."),
            ToolFieldSchema("failedCount", ToolValueType.INTEGER, "Failed contact count.")
        )
    )

    override suspend fun execute(arguments: Map<String, Any?>, context: ToolContext): ToolResult {
        val contacts = arguments.mapListArg("contacts")
        if (contacts.isEmpty()) return ToolResult(false, "", "contacts 不能为空")
        var created = 0
        var failed = 0
        val creator = CreateContactTool(this.context)
        contacts.forEach { contact ->
            val result = creator.execute(contact, context)
            if (result.success) created++ else failed++
        }
        return ToolResult(true, jsonOutput(mapOf("createdCount" to created, "failedCount" to failed)))
    }
}
