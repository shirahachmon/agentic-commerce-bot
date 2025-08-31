
    import express from "express";
    import cors from "cors";
    import dotenv from "dotenv";
    import path from "path";
    import { fileURLToPath } from "url";
    import { ChatOpenAI } from "@langchain/openai";

    dotenv.config();
    const app = express();
    app.use(cors());
    app.use(express.json());

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    app.use(express.static(path.join(__dirname, "public")));

    const llm = new ChatOpenAI({ apiKey: process.env.OPENAI_API_KEY, model: "gpt-4o-mini" });

    const products = [
      { id: "SKU123", name: "Running Shoes", price: 299, stock: 17, url: "/p/sku123" },
      { id: "SKU777", name: "Yoga Pants", price: 149, stock: 0,  url: "/p/sku777" },
      { id: "SKU999", name: "Trail Jacket", price: 499, stock: 5,  url: "/p/sku999" }
    ];

    function findProduct(query) {
      const q = (query||"").toLowerCase();
      return products.find(p => p.id.toLowerCase() === q || p.name.toLowerCase().includes(q));
    }

    app.get("/api/products", (req, res) => {
      const q = req.query.q || "";
      const p = findProduct(q);
      if (!p) return res.json({ found: false });
      res.json({ found: true, product: p });
    });

    app.post("/api/chat", async (req, res) => {
      try {
        const { message } = req.body || {};
        if (!message) return res.status(400).json({ error: "Missing message" });

        // naive intent detection for demo
        if (/price|stock|sku|מחיר|מלאי|החזרות|משלוח/i.test(message)) {
          // If product lookup is requested
          const match = message.match(/sku\s*[:#]?\s*(\w+)/i);
          let p = null;
          if (match) {
            p = findProduct(match[1]);
          } else {
            p = findProduct(message);
          }
          if (p) {
            return res.json({ reply: `Product: ${p.name} (SKU ${p.id})\nPrice: ₪${p.price}\nStock: ${p.stock}\nLink: ${p.url}` });
          }
          // otherwise, generic policy/FAQ answer via LLM
          const faqPrompt = `You are a customer support assistant for an online shop.
The user asked: "${message}"
If they ask about returns or shipping, provide a clear, short policy:
- Returns: 30 days from delivery, original condition, refund to original payment.
- Shipping: 2-5 business days domestic, 7-12 days international.
If they ask about price or stock but product not found, apologize and ask for SKU.`;
          const resp = await llm.invoke([{ role: "user", content: faqPrompt }]);
          return res.json({ reply: resp.content });
        } else {
          const polite = await llm.invoke([{ role: "user", content: `Answer politely as a shopping assistant: ${message}` }]);
          return res.json({ reply: polite.content });
        }
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message || "Chat failed" });
      }
    });

    const PORT = process.env.PORT || 3002;
    app.listen(PORT, () => console.log(`AI Commerce Bot running on http://localhost:${PORT}`));
