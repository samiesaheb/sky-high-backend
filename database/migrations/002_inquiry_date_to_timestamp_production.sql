-- Migration: Change inquiry_date from DATE to TIMESTAMP (Production)
-- This allows storing both date and time for inquiries

-- Step 1: Drop all dependent views
DROP VIEW IF EXISTS vw_inquiry_details_full;
DROP VIEW IF EXISTS vw_inquiry_summary;

-- Step 2: Alter the column type from DATE to TIMESTAMP
ALTER TABLE inquiry_headers
ALTER COLUMN inquiry_date TYPE TIMESTAMP
USING inquiry_date::TIMESTAMP;

-- Step 3: Update the default to include time
ALTER TABLE inquiry_headers
ALTER COLUMN inquiry_date SET DEFAULT CURRENT_TIMESTAMP;

-- Step 4: Recreate vw_inquiry_details_full
CREATE VIEW vw_inquiry_details_full AS
SELECT id.detail_id,
    id.inquiry_id,
    ih.inquiry_number,
    ih.inquiry_date,
    ih.inquiry_description,
    c.customer_name,
    c.contact_person,
    co.country_name,
    pc.category_name AS product_category,
    m.material_name,
    m.material_category,
    t.task_name,
    a.assignee_name,
    a.title AS assignee_title,
    a.department AS assignee_department,
    id.status AS detail_status,
    id.progress,
    id.start_date,
    id.due_date,
    id.estimated_cost,
    id.actual_cost,
    id.actual_cost - id.estimated_cost AS cost_variance,
    id.customer_approved,
    id.remarks AS detail_remarks,
    ih.status AS inquiry_status,
    ih.remarks AS inquiry_remarks,
    ih.created_by,
    ih.created_at,
    ih.modified_by,
    ih.modified_at
FROM inquiry_details id
    JOIN inquiry_headers ih ON id.inquiry_id = ih.inquiry_id
    JOIN customers c ON ih.customer_id = c.customer_id
    LEFT JOIN countries co ON c.country_id = co.country_id
    LEFT JOIN product_categories pc ON ih.product_category_id = pc.product_category_id
    LEFT JOIN materials m ON id.material_id = m.material_id
    LEFT JOIN tasks t ON id.task_id = t.task_id
    LEFT JOIN assignees a ON id.assignee_id = a.assignee_id;

-- Step 5: Recreate vw_inquiry_summary
CREATE VIEW vw_inquiry_summary AS
SELECT ih.inquiry_id,
    ih.inquiry_number,
    ih.inquiry_date,
    ih.inquiry_description,
    c.customer_id,
    c.customer_name,
    co.country_name,
    pc.category_name AS product_category,
    ih.product_category_id,
    ih.status,
    ih.inquiry_group,
    ih.currency,
    ih.total_estimated_cost,
    ih.total_actual_cost,
    ih.total_actual_cost - ih.total_estimated_cost AS total_variance,
    ih.overall_progress,
    ih.remarks,
    ih.conclusion,
    count(id.detail_id) AS detail_count,
    count(
        CASE
            WHEN id.status::text = 'Completed'::text THEN 1
            ELSE NULL::integer
        END) AS completed_details,
    count(
        CASE
            WHEN id.due_date < CURRENT_DATE AND (id.status::text <> ALL (ARRAY['Completed'::character varying, 'Cancelled'::character varying]::text[])) THEN 1
            ELSE NULL::integer
        END) AS overdue_details,
    ih.created_by,
    ih.created_at,
    ih.modified_at
FROM inquiry_headers ih
    JOIN customers c ON ih.customer_id = c.customer_id
    LEFT JOIN countries co ON c.country_id = co.country_id
    LEFT JOIN product_categories pc ON ih.product_category_id = pc.product_category_id
    LEFT JOIN inquiry_details id ON ih.inquiry_id = id.inquiry_id
GROUP BY ih.inquiry_id, c.customer_id, c.customer_name, co.country_name, pc.category_name;

-- Verify the change
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'inquiry_headers' AND column_name = 'inquiry_date';
