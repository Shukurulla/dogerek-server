import Category from "../models/Category.js";
import Club from "../models/Club.js";
import { formatResponse } from "../utils/formatters.js";

// Create category
export const createCategory = async (req, res) => {
  try {
    const { name, description, color, icon } = req.body;

    // Validation
    if (!name) {
      return res
        .status(400)
        .json(formatResponse(false, null, "Kategoriya nomi kiritilishi shart"));
    }

    // Check if category exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res
        .status(400)
        .json(formatResponse(false, null, "Bu kategoriya allaqachon mavjud"));
    }

    // Create new category
    const category = new Category({
      name,
      description,
      color: color || "#1890ff",
      icon: icon || "BookOutlined",
      createdBy: req.user.id,
    });

    await category.save();

    res
      .status(201)
      .json(
        formatResponse(true, category, "Kategoriya muvaffaqiyatli yaratildi")
      );
  } catch (error) {
    console.error("Create category error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get all categories
export const getAllCategories = async (req, res) => {
  try {
    const { isActive } = req.query;

    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const categories = await Category.find(filter)
      .populate("createdBy", "profile.fullName")
      .sort("-createdAt");

    // Add clubs count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const clubCount = await Club.countDocuments({
          category: category._id,
          isActive: true,
        });

        return {
          ...category.toObject(),
          clubCount,
        };
      })
    );

    res.json(
      formatResponse(true, categoriesWithCount, "Kategoriyalar ro'yxati")
    );
  } catch (error) {
    console.error("Get categories error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Update category
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, icon, isActive } = req.body;

    const category = await Category.findById(id);

    if (!category) {
      return res
        .status(404)
        .json(formatResponse(false, null, "Kategoriya topilmadi"));
    }

    // Check if name is unique (if changing)
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        return res
          .status(400)
          .json(formatResponse(false, null, "Bu nom bilan kategoriya mavjud"));
      }
      category.name = name;
    }

    // Update fields
    if (description !== undefined) category.description = description;
    if (color) category.color = color;
    if (icon) category.icon = icon;
    if (typeof isActive === "boolean") category.isActive = isActive;

    category.updatedAt = new Date();
    await category.save();

    res.json(
      formatResponse(true, category, "Kategoriya ma'lumotlari yangilandi")
    );
  } catch (error) {
    console.error("Update category error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Delete category
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res
        .status(404)
        .json(formatResponse(false, null, "Kategoriya topilmadi"));
    }

    // Check if category has clubs
    const clubCount = await Club.countDocuments({
      category: id,
      isActive: true,
    });

    if (clubCount > 0) {
      return res
        .status(400)
        .json(
          formatResponse(
            false,
            null,
            `Bu kategoriyaga ${clubCount} ta to'garak biriktirilgan. Avval ularni boshqa kategoriyaga o'tkazing`
          )
        );
    }

    // Soft delete
    category.isActive = false;
    category.updatedAt = new Date();
    await category.save();

    res.json(formatResponse(true, null, "Kategoriya o'chirildi"));
  } catch (error) {
    console.error("Delete category error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};

// Get category by ID
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res
        .status(404)
        .json(formatResponse(false, null, "Kategoriya topilmadi"));
    }

    // Get clubs in this category
    const clubs = await Club.find({
      category: id,
      isActive: true,
    })
      .populate("tutor", "profile.fullName")
      .populate("faculty", "name")
      .select("name faculty tutor capacity");

    const categoryData = {
      ...category.toObject(),
      clubs,
      clubCount: clubs.length,
    };

    res.json(formatResponse(true, categoryData, "Kategoriya ma'lumotlari"));
  } catch (error) {
    console.error("Get category by ID error:", error);
    res
      .status(500)
      .json(formatResponse(false, null, "Server xatosi", error.message));
  }
};
