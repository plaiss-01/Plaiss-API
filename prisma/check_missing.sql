SELECT 
  COUNT(*) as total_products,
  COUNT(*) FILTER (WHERE "imageUrl" IS NULL OR "imageUrl" = '' OR "imageUrl" = 'Original') as no_image,
  COUNT(*) FILTER (WHERE ("colour" IS NULL OR "colour" = '' OR "colour" = 'Original') AND ("sizeStockStatus" IS NULL OR "sizeStockStatus" = '')) as no_color_or_size,
  COUNT(*) FILTER (
    WHERE ("imageUrl" IS NULL OR "imageUrl" = '' OR "imageUrl" = 'Original') 
      AND ("colour" IS NULL OR "colour" = '' OR "colour" = 'Original') 
      AND ("sizeStockStatus" IS NULL OR "sizeStockStatus" = '')
  ) as missing_all
FROM "Product";
