package com.xiaoxiami.app.service

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.util.concurrent.ConcurrentHashMap

class MiotSpecService(private val context: Context) {

    companion object {
        private const val TAG = "MiotSpecService"
        private const val SPEC_URL = "https://home.miot-spec.com/spec/"
    }

    private val client = OkHttpClient()
    private val memoryCache = ConcurrentHashMap<String, MiotSpec>()

    private fun getCacheDir(): File {
        val dir = File(context.cacheDir, "miot_spec")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    suspend fun getDeviceSpec(model: String): MiotSpec? = withContext(Dispatchers.IO) {
        // Memory cache
        memoryCache[model]?.let { return@withContext it }

        // Disk cache
        val cacheFile = File(getCacheDir(), "$model.json")
        if (cacheFile.exists()) {
            try {
                val spec = parseSpecFromCache(JSONObject(cacheFile.readText()))
                memoryCache[model] = spec
                return@withContext spec
            } catch (e: Exception) {
                Log.w(TAG, "Failed to read cache for $model", e)
                cacheFile.delete()
            }
        }

        // Network fetch
        try {
            val request = Request.Builder()
                .url(SPEC_URL + model)
                .header("User-Agent", "MiotSpec/1.0")
                .get()
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                Log.w(TAG, "Failed to fetch spec for $model: ${response.code}")
                return@withContext null
            }

            val html = response.body?.string() ?: return@withContext null
            val spec = parseSpecFromHtml(html, model) ?: return@withContext null

            // Save to disk cache
            try {
                val cacheJson = specToJson(spec)
                cacheFile.writeText(cacheJson.toString(2))
            } catch (e: Exception) {
                Log.w(TAG, "Failed to cache spec for $model", e)
            }

            memoryCache[model] = spec
            spec
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get spec for $model", e)
            null
        }
    }

    private fun parseSpecFromHtml(html: String, model: String): MiotSpec? {
        // Extract JSON from data-page attribute (same pattern as mijiaAPI/devices.py)
        val regex = """data-page="(.*?)">""".toRegex()
        val match = regex.find(html) ?: return null
        val rawJson = match.groupValues[1].replace("&quot;", "\"").replace("&amp;", "&")
        val pageData = JSONObject(rawJson)

        val product = pageData.optJSONObject("props")?.optJSONObject("product")
        val specObj = pageData.optJSONObject("props")?.optJSONObject("spec") ?: return null

        val name = product?.optString("name") ?: specObj.optString("name", model)
        val services = specObj.optJSONObject("services") ?: return null

        val properties = mutableListOf<MiotProperty>()
        val actions = mutableListOf<MiotAction>()
        val propNames = mutableSetOf<String>()
        val actionNames = mutableSetOf<String>()

        val serviceKeys = services.keys()
        while (serviceKeys.hasNext()) {
            val siidStr = serviceKeys.next()
            val service = services.getJSONObject(siidStr)
            val serviceName = service.optString("name", "")

            // Parse properties
            service.optJSONObject("properties")?.let { propsObj ->
                val piidKeys = propsObj.keys()
                while (piidKeys.hasNext()) {
                    val piidStr = piidKeys.next()
                    val prop = propsObj.getJSONObject(piidStr)

                    val format = prop.optString("format", "bool")
                    val propType = when {
                        format.startsWith("int") -> "int"
                        format.startsWith("uint") -> "uint"
                        else -> format
                    }

                    val access = prop.optJSONArray("access")
                    val rw = buildString {
                        if (access != null) {
                            val accessList = (0 until access.length()).map { access.getString(it) }
                            if ("read" in accessList) append("r")
                            if ("write" in accessList) append("w")
                        }
                    }

                    var propName = prop.optString("name", "unknown")
                    if (propName in propNames) {
                        propName = "$serviceName-$propName"
                    }
                    propNames.add(propName)

                    val range = prop.optJSONArray("value-range")?.let { arr ->
                        (0 until arr.length()).map { arr.optDouble(it).let { v -> if (v == v.toLong().toDouble()) v.toLong() as Number else v as Number } }
                    }

                    val valueList = prop.optJSONArray("value-list")?.let { arr ->
                        (0 until arr.length()).map { i ->
                            val item = arr.getJSONObject(i)
                            MiotValueItem(item.optInt("value"), item.optString("description"))
                        }
                    }

                    properties.add(MiotProperty(
                        name = propName,
                        description = "${prop.optString("description", "")} / ${prop.optString("desc_zh_cn", "")}",
                        type = propType,
                        rw = rw,
                        unit = prop.optString("unit", "").let { if (it == "none") null else it },
                        range = range,
                        valueList = valueList,
                        siid = siidStr.toIntOrNull() ?: 0,
                        piid = piidStr.toIntOrNull() ?: 0
                    ))
                }
            }

            // Parse actions
            service.optJSONObject("actions")?.let { actsObj ->
                val aiidKeys = actsObj.keys()
                while (aiidKeys.hasNext()) {
                    val aiidStr = aiidKeys.next()
                    val act = actsObj.getJSONObject(aiidStr)

                    var actName = act.optString("name", "unknown")
                    if (actName in actionNames) {
                        actName = "$serviceName-$actName"
                    }
                    actionNames.add(actName)

                    actions.add(MiotAction(
                        name = actName,
                        description = "${act.optString("description", "")} / ${act.optString("desc_zh_cn", "")}",
                        siid = siidStr.toIntOrNull() ?: 0,
                        aiid = aiidStr.toIntOrNull() ?: 0
                    ))
                }
            }
        }

        return MiotSpec(name = name, model = model, properties = properties, actions = actions)
    }

    private fun parseSpecFromCache(json: JSONObject): MiotSpec {
        val properties = mutableListOf<MiotProperty>()
        val actions = mutableListOf<MiotAction>()

        json.optJSONArray("properties")?.let { arr ->
            for (i in 0 until arr.length()) {
                val p = arr.getJSONObject(i)
                val range = p.optJSONArray("range")?.let { r ->
                    (0 until r.length()).map { r.optDouble(it).let { v -> if (v == v.toLong().toDouble()) v.toLong() as Number else v as Number } }
                }
                val valueList = p.optJSONArray("valueList")?.let { vl ->
                    (0 until vl.length()).map { j ->
                        val item = vl.getJSONObject(j)
                        MiotValueItem(item.optInt("value"), item.optString("description"))
                    }
                }
                properties.add(MiotProperty(
                    name = p.optString("name"),
                    description = p.optString("description"),
                    type = p.optString("type"),
                    rw = p.optString("rw"),
                    unit = p.optString("unit").let { if (it.isBlank()) null else it },
                    range = range,
                    valueList = valueList,
                    siid = p.optInt("siid"),
                    piid = p.optInt("piid")
                ))
            }
        }

        json.optJSONArray("actions")?.let { arr ->
            for (i in 0 until arr.length()) {
                val a = arr.getJSONObject(i)
                actions.add(MiotAction(
                    name = a.optString("name"),
                    description = a.optString("description"),
                    siid = a.optInt("siid"),
                    aiid = a.optInt("aiid")
                ))
            }
        }

        return MiotSpec(
            name = json.optString("name"),
            model = json.optString("model"),
            properties = properties,
            actions = actions
        )
    }

    private fun specToJson(spec: MiotSpec): JSONObject {
        val json = JSONObject()
        json.put("name", spec.name)
        json.put("model", spec.model)

        val propsArray = org.json.JSONArray()
        spec.properties.forEach { p ->
            val pj = JSONObject()
            pj.put("name", p.name)
            pj.put("description", p.description)
            pj.put("type", p.type)
            pj.put("rw", p.rw)
            pj.put("unit", p.unit ?: "")
            p.range?.let { r ->
                val ra = org.json.JSONArray()
                r.forEach { ra.put(it) }
                pj.put("range", ra)
            }
            p.valueList?.let { vl ->
                val va = org.json.JSONArray()
                vl.forEach { item ->
                    val ij = JSONObject()
                    ij.put("value", item.value)
                    ij.put("description", item.description)
                    va.put(ij)
                }
                pj.put("valueList", va)
            }
            pj.put("siid", p.siid)
            pj.put("piid", p.piid)
            propsArray.put(pj)
        }
        json.put("properties", propsArray)

        val actsArray = org.json.JSONArray()
        spec.actions.forEach { a ->
            val aj = JSONObject()
            aj.put("name", a.name)
            aj.put("description", a.description)
            aj.put("siid", a.siid)
            aj.put("aiid", a.aiid)
            actsArray.put(aj)
        }
        json.put("actions", actsArray)

        return json
    }

    fun findProperty(spec: MiotSpec, name: String): MiotProperty? {
        return spec.properties.find {
            it.name.equals(name, ignoreCase = true) ||
            it.name.replace("-", "_").equals(name.replace("-", "_"), ignoreCase = true)
        }
    }

    fun findAction(spec: MiotSpec, name: String): MiotAction? {
        return spec.actions.find {
            it.name.equals(name, ignoreCase = true) ||
            it.name.replace("-", "_").equals(name.replace("-", "_"), ignoreCase = true)
        }
    }
}
