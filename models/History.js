import mongoose from "mongoose";

const historySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false   // ✅ FIXED
    },

    originalCode: {
      type: String,
      required: true
    },

    output: {
      type: String,
      required: true
    },

    sourceLang: {
      type: String,
      default: "auto"
    },

    targetLang: {
      type: String
    },

    type: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("History", historySchema);