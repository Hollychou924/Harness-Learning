package demo;

import com.google.gson.Gson;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;


public class Main {

    private static final String SUBMIT_URL = "https://openspeech.bytedance.com/api/v3/auc/lark/submit";
    private static final String QUERY_URL = "https://openspeech.bytedance.com/api/v3/auc/lark/query";
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    private static final OkHttpClient client = new OkHttpClient.Builder()
    .connectTimeout(60, TimeUnit.SECONDS)    // 连接超时
    .readTimeout(60, TimeUnit.SECONDS)      // 读取超时
    .writeTimeout(60, TimeUnit.SECONDS)     // 写入超时
    .callTimeout(60, TimeUnit.SECONDS)      // 整个调用超时(包括重定向)
    .build();

    public static void main(String[] args) throws IOException, InterruptedException {
        // 从命令行参数中获取对应的值
        final String APPID = args[0];
        final String TOKEN = args[1];
        final String FILE_URL = args[2];
        
        String[] result = submitTask(FILE_URL, APPID, TOKEN);
        String taskId = result[0];
        String xTtLogid = result[1];

        if (taskId == "") {
            System.out.println("Submit task failed");
            System.exit(1);
        }

        while (true) {
            Response queryResponse = queryTask(taskId, xTtLogid, APPID, TOKEN);
            String code = queryResponse.header("X-Api-Status-Code", "");
            if ("20000000".equals(code)) {
                String body = queryResponse.body().string();
                System.out.println("Response Body: " + body);
                
                // 解析响应体中的JSON
                try {
                    Gson gson = new Gson();
                    Map<String, Object> responseMap = gson.fromJson(body, Map.class);
                    if (responseMap != null && responseMap.containsKey("Data")) {
                        Map<String, Object> dataMap = (Map<String, Object>) responseMap.get("Data");
                        if (dataMap != null && dataMap.containsKey("Status")) {
                            String status = dataMap.get("Status").toString();
                            System.out.println("Task Status: " + status);
                            if ("running".equals(status)) {
                                System.out.println("Task is still running, continue polling...");
                                Thread.sleep(30000);
                                continue;
                            } else {
                                // 任务完成，提取Result并打印
                                if (dataMap.containsKey("Result")) {
                                    Map<String, Object> resultMap = (Map<String, Object>) dataMap.get("Result");
                                    System.out.println("Task completed! Result:");
                                    System.out.println("AudioTranscriptionFile: " + resultMap.get("AudioTranscriptionFile"));
                                    System.out.println("ChapterFile: " + resultMap.get("ChapterFile"));
                                    System.out.println("InformationExtractionFile: " + resultMap.get("InformationExtractionFile"));
                                    System.out.println("SummarizationFile: " + resultMap.get("SummarizationFile"));
                                    System.out.println("TranslationFile: " + resultMap.get("TranslationFile"));
                                }
                                
                                System.out.println("SUCCESS!");
                                try (BufferedWriter writer = Files.newBufferedWriter(
                                        Paths.get("response_output.json"),
                                        StandardCharsets.UTF_8,
                                        StandardOpenOption.CREATE,
                                        StandardOpenOption.TRUNCATE_EXISTING)) {
                                    writer.write(body);
                                    System.out.println("写入成功！");
                                } catch (IOException e) {
                                    e.printStackTrace();
                                }
                                System.exit(0);
                            }
                        }
                    }
                } catch (Exception e) {
                    System.out.println("解析JSON失败: " + e.getMessage());
                    System.exit(1);
                }
            } else if (!"20000001".equals(code) && !"20000002".equals(code)) {
                System.out.println("FAILED!");
                System.exit(1);
            }
            Thread.sleep(1000);
        }
    }

    private static String[] submitTask(String FILE_URL, String APPID, String TOKEN) throws IOException {
        String requestId = UUID.randomUUID().toString();
        System.out.println("Submit requestId: " + requestId);
        
        // 创建新的请求体结构
        Map<String, Object> input = new HashMap<>();
        Map<String, Object> offline = new HashMap<>();
        offline.put("FileURL", FILE_URL);
        offline.put("FileType", "audio");
        input.put("Offline", offline);
        
        Map<String, Object> audioTranscriptionParams = new HashMap<>();
        audioTranscriptionParams.put("SpeakerIdentification", false);
        audioTranscriptionParams.put("NumberOfSpeaker", 0);
        
        Map<String, Object> translationParams = new HashMap<>();
        translationParams.put("TargetLang", "zh_cn");
        
        Map<String, Object> informationExtractionParams = new HashMap<>();
        informationExtractionParams.put("Types", new String[]{"todo_list", "question_answer", "transition"});
        
        Map<String, Object> summarizationParams = new HashMap<>();
        summarizationParams.put("Types", new String[]{"summary"});
        
        Map<String, Object> params = new HashMap<>();
        params.put("AllActivate", true);
        params.put("SourceLang", "zh_cn");
        params.put("AudioTranscriptionEnable", true);
        params.put("AudioTranscriptionParams", audioTranscriptionParams);
        params.put("TranslationEnable", true);
        params.put("TranslationParams", translationParams);
        params.put("InformationExtractionEnabled", true);
        params.put("InformationExtractionParams", informationExtractionParams);
        params.put("SummarizationEnabled", true);
        params.put("SummarizationParams", summarizationParams);
        params.put("ChapterEnabled", true);
        
        Map<String, Object> mainRequest = new HashMap<>();
        mainRequest.put("Input", input);
        mainRequest.put("Params", params);

        // 使用 Gson 转换为 JSON 字符串
        Gson gson = new Gson();
        String jsonString = gson.toJson(mainRequest);
        
        System.out.println("Submit mainRequest: " + jsonString + "\n");   
        RequestBody body = RequestBody.create(jsonString, JSON);

        Request request = new Request.Builder()
        .url(SUBMIT_URL)
        // .header("x-use-ppe", "1")  
        // .header("x-tt-env", "ppe_volc_lark") 
        .header("X-Api-App-Key", APPID)  
        .header("X-Api-Access-Key", TOKEN)  
        .header("X-Api-Resource-Id", "volc.lark.minutes")
        .header("X-Api-Request-Id", requestId)  // 
        .header("X-Api-Sequence", "-1")
        .header("Content-Type", "application/json")  
        .post(body) 
        .build();

        String responseBody = "";
        try (Response response = client.newCall(request).execute()) {
            responseBody = response.body() != null ? response.body().string() : "";
            System.out.println("Response Body: " + responseBody); // 打印响应体内容
            if ("20000000".equals(response.header("X-Api-Status-Code"))) {
                System.out.println("Submit task response header X-Api-Status-Code: " + response.header("X-Api-Status-Code"));
                System.out.println("Submit task response header X-Api-Message: " + response.header("X-Api-Message"));
                String xTtLogid = response.header("X-Tt-Logid", "");
                String taskId = "";
                try {
                    Map<String, Object> responseMap = gson.fromJson(responseBody, Map.class);
                    if (responseMap != null && responseMap.containsKey("Data")) {
                        Map<String, Object> dataMap = (Map<String, Object>) responseMap.get("Data");
                        if (dataMap != null && dataMap.containsKey("TaskID")) {
                            taskId = dataMap.get("TaskID").toString();
                        }
                    }
                } catch (Exception e) {
                    System.out.println("解析JSON失败: " + e.getMessage());
                    // 如果JSON解析失败，回退到从header获取
                    taskId = "";
                }
                System.out.println("提取的TaskID: " + taskId);
                System.out.println("Submit task response header X-Tt-Logid: " + xTtLogid + "\n");
                return new String[]{taskId, xTtLogid};
            } else {
                System.out.println("Submit task failed and the response headers are: " + response.headers());
                System.exit(1);
            }
        }
        return new String[]{"", ""};
    }

    private static Response queryTask(String taskId, String xTtLogid, String APPID, String TOKEN) throws IOException {
        // 构造请求体，将taskId放在body中
        Map<String, Object> queryRequest = new HashMap<>();
        queryRequest.put("TaskID", taskId);
        
        Gson gson = new Gson();
        String jsonString = gson.toJson(queryRequest);
        System.out.println("Query request body: " + jsonString);
        
        RequestBody body = RequestBody.create(jsonString, JSON);
        
        Request request = new Request.Builder()
        .url(QUERY_URL)
        .header("X-Api-App-Key", APPID) 
        .header("X-Api-Access-Key", TOKEN)  
        .header("X-Api-Resource-Id", "volc.lark.minutes")
        .header("Content-Type", "application/json")
        // .header("x-use-ppe", "1")  
        // .header("x-tt-env", "ppe_volc_lark") 
        .header("X-Api-Sequence", "-1")
        .header("X-Api-Request-Id", "1")  // 
        .post(body)  // 这里的body应该是RequestBody对象
        .build();

        Response response = client.newCall(request).execute();
        if (response.header("X-Api-Status-Code") != null) {
            System.out.println("Query task response header X-Api-Status-Code: " + response.header("X-Api-Status-Code"));
            System.out.println("Query task response header X-Api-Message: " + response.header("X-Api-Message"));
            System.out.println("Query task response header X-Tt-Logid: " + response.header("X-Tt-Logid") + "\n");
        } else {
            System.out.println("Query task failed and the response headers are: " + response.headers());
            System.exit(1);
        }
        return response;
    }
    
}
