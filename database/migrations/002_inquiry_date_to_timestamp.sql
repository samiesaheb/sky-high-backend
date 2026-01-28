-- Migration: Change inquiry_date from DATE to TIMESTAMP
-- This allows storing both date and time for inquiries

-- Step 1: Drop the dependent view
DROP VIEW IF EXISTS vw_inquiry_holistic;

-- Step 2: Alter the column type from DATE to TIMESTAMP
ALTER TABLE inquiry_headers
ALTER COLUMN inquiry_date TYPE TIMESTAMP
USING inquiry_date::TIMESTAMP;

-- Step 3: Update the default to include time
ALTER TABLE inquiry_headers
ALTER COLUMN inquiry_date SET DEFAULT CURRENT_TIMESTAMP;

-- Step 4: Recreate the view
CREATE VIEW vw_inquiry_holistic AS
SELECT h.inquiry_id,
    h.inquiry_date,
    h.inquiry_description,
    c.customer_name,
    co.country_name,
    pc.product_category_description,
    hs.status_description AS header_status,
    d.material_id,
    m.material_name AS material_description,
    mt.material_type_description,
    t.task_name AS task_description,
    a.assignee_name,
    ds.status_description AS detail_status,
    d.customer_approved,
    d.remarks AS detail_remarks,
    h.remarks AS header_remarks
FROM inquiry_headers h
    LEFT JOIN customers c ON h.customer_id = c.customer_id
    LEFT JOIN countries co ON c.country_id = co.country_id
    LEFT JOIN product_categories pc ON h.product_category_id = pc.product_category_id
    LEFT JOIN status_master hs ON h.status_id = hs.status_id
    LEFT JOIN inquiry_details d ON h.inquiry_id = d.inquiry_id
    LEFT JOIN materials m ON d.material_id = m.material_id
    LEFT JOIN material_types mt ON m.material_type_id = mt.material_type_id
    LEFT JOIN tasks t ON d.task_id = t.task_id
    LEFT JOIN assignees a ON d.assignee_id = a.assignee_id
    LEFT JOIN status_master ds ON d.status_id = ds.status_id;

-- Verify the change
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'inquiry_headers' AND column_name = 'inquiry_date';
