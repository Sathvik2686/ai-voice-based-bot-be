import Translation from "../models/Translation.js";

// GET USER HISTORY
export const getHistory = async (req, res) => {
  try {

    const history = await Translation.find({
      user: req.user.id
    }).sort({ createdAt: -1 });

    res.json(history);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Error fetching history"
    });
  }
};

// DELETE HISTORY ITEM
export const deleteHistory = async (req, res) => {
  try {

    await Translation.findByIdAndDelete(
      req.params.id
    );

    res.json({
      message: "History deleted"
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "Delete failed"
    });
  }
};