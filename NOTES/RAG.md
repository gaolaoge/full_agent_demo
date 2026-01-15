实现步骤：

- 加载文档：使用 TextLoader 等文档加载器。

- 分割文本：使用 RecursiveCharacterTextSplitter 分割成块。

- 嵌入向量化：使用 OpenAI 或本地嵌入模型将文本块转为向量。

- 创建向量存储：将向量存入 Chroma、Pinecone 等向量数据库。

- 构建检索链：

  - 将用户问题向量化。

  - 在向量库中检索最相关的文本块。

  - 将检索到的文本块与问题组合成提示。

  - 调用 LLM 生成最终答案。
