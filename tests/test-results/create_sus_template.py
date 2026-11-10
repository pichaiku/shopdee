"""
Create the SUS (System Usability Scale) workbook: tests/test-results/SUS_Test.xlsx

usage:
  python tests/test-results/create_sus_template.py            # empty sheet, ready for real responses
  python tests/test-results/create_sus_template.py --sample   # fill with clearly-labelled demo data
Rows that are not completely filled in (all 10 answers) are left out of the scores and the averages.
"""
import argparse
from pathlib import Path

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, Reference

def create_sus_template(with_sample=False):
    # Create workbook and setup sheets
    wb = openpyxl.Workbook()
    
    # Setup Dashboard sheet (default sheet)
    ws_dash = wb.active
    ws_dash.title = "Dashboard"
    ws_dash.views.sheetView[0].showGridLines = True
    
    # Setup Data sheet
    ws_data = wb.create_sheet(title="SUS Data")
    ws_data.views.sheetView[0].showGridLines = True
    
    # Define Colors (Slate & Indigo Palette)
    COLOR_PRIMARY = "1E293B"     # Slate 800 (Dark Header)
    COLOR_SECONDARY = "475569"   # Slate 600 (Sub-headers)
    COLOR_LIGHT_BG = "F8FAFC"    # Slate 50 (Zebra striping)
    COLOR_BORDER = "E2E8F0"      # Slate 200 (Grid borders)
    COLOR_CARD_HEADER = "F1F5F9" # Slate 100 (KPI Card Header)
    COLOR_KPI_VAL = "1E3A8A"     # Dark Blue for values
    COLOR_HIGHLIGHT = "EFF6FF"   # Light Blue for active indicators
    COLOR_ACCENT = "3B82F6"      # Accent Blue
    
    # Fonts
    font_title = Font(name="Segoe UI", size=16, bold=True, color="FFFFFF")
    font_sub_title = Font(name="Segoe UI", size=11, italic=True, color="E2E8F0")
    font_section = Font(name="Segoe UI", size=12, bold=True, color="0F172A")
    font_header = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
    font_kpi_lbl = Font(name="Segoe UI", size=9, bold=True, color="475569")
    font_kpi_val = Font(name="Segoe UI", size=20, bold=True, color=COLOR_KPI_VAL)
    font_body = Font(name="Segoe UI", size=10, color="0F172A")
    font_body_bold = Font(name="Segoe UI", size=10, bold=True, color="0F172A")
    font_italic = Font(name="Segoe UI", size=9, italic=True, color="475569")
    
    # Fills
    fill_primary = PatternFill(start_color=COLOR_PRIMARY, end_color=COLOR_PRIMARY, fill_type="solid")
    fill_secondary = PatternFill(start_color=COLOR_SECONDARY, end_color=COLOR_SECONDARY, fill_type="solid")
    fill_zebra = PatternFill(start_color=COLOR_LIGHT_BG, end_color=COLOR_LIGHT_BG, fill_type="solid")
    fill_card_lbl = PatternFill(start_color=COLOR_CARD_HEADER, end_color=COLOR_CARD_HEADER, fill_type="solid")
    fill_white = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
    fill_highlight = PatternFill(start_color=COLOR_HIGHLIGHT, end_color=COLOR_HIGHLIGHT, fill_type="solid")
    
    # Borders
    thin = Side(border_style="thin", color=COLOR_BORDER)
    border_all = Border(left=thin, right=thin, top=thin, bottom=thin)
    border_double_bottom = Border(bottom=Side(border_style="double", color="000000"), top=thin)
    
    # Alignments
    align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
    align_right = Alignment(horizontal="right", vertical="center", wrap_text=True)
    
    # Helper to style a range of cells
    def style_range(ws, cell_range, font=None, fill=None, border=None, alignment=None):
        if ":" in cell_range:
            cells = ws[cell_range]
        else:
            cells = [[ws[cell_range]]]
        for row in cells:
            for cell in row:
                if font:
                    cell.font = font
                if fill:
                    cell.fill = fill
                if border:
                    cell.border = border
                if alignment:
                    cell.alignment = alignment

    # ----------------------------------------------------
    # SHEET 1: DASHBOARD
    # ----------------------------------------------------
    ws_dash.row_dimensions[1].height = 25
    ws_dash.row_dimensions[2].height = 20
    ws_dash.merge_cells("A1:Q2")
    ws_dash["A1"] = "SYSTEM USABILITY SCALE (SUS) TEST DASHBOARD"
    ws_dash["A1"].font = font_title
    ws_dash["A1"].fill = fill_primary
    ws_dash["A1"].alignment = align_center
    
    # Set Dashboard Column Widths
    col_widths_dash = {
        'A': 3,   # Left Margin
        'B': 8,   # QID
        'C': 12,  # Text / Bracket
        'D': 6,   # Gap / Grade
        'E': 12,  # KPI Card / Adjective
        'F': 12,  # KPI Card / Adjective
        'G': 6,   # Gap / Acceptability
        'H': 12,  # KPI Card / Acceptability
        'I': 12,  # KPI Card / Description
        'J': 6,   # Gap / Description
        'K': 12,  # KPI Card / Description
        'L': 12,  # KPI Card / Status
        'M': 6,   # Gap
        'N': 12,  # KPI Card / Total
        'O': 12,  # KPI Card / Total
        'P': 12,  # Extra for spacing
        'Q': 3    # Right Margin
    }
    for col, width in col_widths_dash.items():
        ws_dash.column_dimensions[col].width = width

    # KPI Section Title
    ws_dash["B4"] = "Key Usability Metrics"
    ws_dash["B4"].font = font_section
    
    # 5 KPI Cards Setup
    # Card 1: Average SUS Score (B5:C6)
    ws_dash.merge_cells("B5:C5")
    ws_dash["B5"] = "AVERAGE SUS SCORE"
    ws_dash.merge_cells("B6:C6")
    ws_dash["B6"] = "='SUS Data'!L36"
    
    # Card 2: Grade (E5:F5)
    ws_dash.merge_cells("E5:F5")
    ws_dash["E5"] = "USABILITY GRADE"
    ws_dash.merge_cells("E6:F6")
    ws_dash["E6"] = "='SUS Data'!M36"
    
    # Card 3: Adjective Rating (H5:I5)
    ws_dash.merge_cells("H5:I5")
    ws_dash["H5"] = "ADJECTIVE RATING"
    ws_dash.merge_cells("H6:I6")
    ws_dash["H6"] = "='SUS Data'!N36"
    
    # Card 4: Acceptability (K5:L5)
    ws_dash.merge_cells("K5:L5")
    ws_dash["K5"] = "ACCEPTABILITY"
    ws_dash.merge_cells("K6:L6")
    ws_dash["K6"] = "=IF(B6>=71.1,\"Acceptable\",IF(B6>=50.9,\"Marginal\",\"Unacceptable\"))"
    
    # Card 5: Total Respondents (N5:O5)
    ws_dash.merge_cells("N5:O5")
    ws_dash["N5"] = "TOTAL RESPONDENTS"
    ws_dash.merge_cells("N6:O6")
    ws_dash["N6"] = "=COUNT('SUS Data'!L16:L35)"
    
    # Style KPI Cards
    kpi_ranges = [("B5:C5", "B6:C6"), ("E5:F5", "E6:F6"), ("H5:I5", "H6:I6"), ("K5:L5", "K6:L6"), ("N5:O5", "N6:O6")]
    for lbl_rng, val_rng in kpi_ranges:
        style_range(ws_dash, lbl_rng, font=font_kpi_lbl, fill=fill_card_lbl, border=border_all, alignment=align_center)
        style_range(ws_dash, val_rng, font=font_kpi_val, fill=fill_white, border=border_all, alignment=align_center)
    ws_dash["B6"].number_format = "0.0"
    ws_dash["N6"].number_format = "#,##0"

    # Reference Section Title
    ws_dash["B8"] = "SUS Benchmarking Reference Table"
    ws_dash["B8"].font = font_section
    
    # Benchmarking Table Headers (Row 9)
    headers_ref = [
        ("B9:C9", "Score Bracket"),
        ("D9", "Grade"),
        ("E9:F9", "Adjective Rating"),
        ("G9:H9", "Acceptability"),
        ("I9:K9", "Interpretation & Action"),
        ("L9:N9", "Current Status")
    ]
    for rng, text in headers_ref:
        if ":" in rng:
            ws_dash.merge_cells(rng)
            start_cell = rng.split(":")[0]
            ws_dash[start_cell] = text
        else:
            ws_dash[rng] = text
            start_cell = rng
        style_range(ws_dash, rng, font=font_header, fill=fill_secondary, border=border_all, alignment=align_center)
        
    # Benchmarking Table Data
    bench_data = [
        (">= 80.3", "A", "Excellent / Best", "Acceptable", "Highly usable system. Promoters category.", "=IF($B$6>=80.3,\"◀ Current Average\",\" \")"),
        ("68.0 - 80.2", "B", "Good", "Acceptable", "Above average usability. (Industry Avg = 68.0)", "=IF(AND($B$6>=68,$B$6<80.3),\"◀ Current Average\",\" \")"),
        ("51.0 - 67.9", "C", "OK", "Marginal", "Below average. System requires usability improvements.", "=IF(AND($B$6>=51,$B$6<68),\"◀ Current Average\",\" \")"),
        ("38.0 - 50.9", "D", "Poor", "Marginal", "Significant usability issues. Redesign recommended.", "=IF(AND($B$6>=38,$B$6<51),\"◀ Current Average\",\" \")"),
        ("< 38.0", "F", "Worst / Poor", "Unacceptable", "Severe usability issues. High user frustration.", "=IF($B$6<38,\"◀ Current Average\",\" \")")
    ]
    
    font_indicator = Font(name="Segoe UI", size=10, bold=True, color="DC2626") # Bold Red indicator
    
    for idx, row in enumerate(bench_data):
        r = 10 + idx
        # Merges
        ws_dash.merge_cells(f"B{r}:C{r}")
        ws_dash.merge_cells(f"E{r}:F{r}")
        ws_dash.merge_cells(f"G{r}:H{r}")
        ws_dash.merge_cells(f"I{r}:K{r}")
        ws_dash.merge_cells(f"L{r}:N{r}")
        
        # Values
        ws_dash[f"B{r}"] = row[0]
        ws_dash[f"D{r}"] = row[1]
        ws_dash[f"E{r}"] = row[2]
        ws_dash[f"G{r}"] = row[3]
        ws_dash[f"I{r}"] = row[4]
        ws_dash[f"L{r}"] = row[5]
        
        # Zebra stripe & Styling
        row_fill = fill_zebra if idx % 2 == 1 else fill_white
        style_range(ws_dash, f"B{r}:N{r}", font=font_body, fill=row_fill, border=border_all, alignment=align_center)
        ws_dash[f"I{r}"].alignment = align_left # Align description to left
        
        # Style current status indicator specifically
        style_range(ws_dash, f"L{r}:N{r}", font=font_indicator, fill=row_fill, border=border_all, alignment=align_center)

    # Item Breakdown Section Title
    ws_dash["B17"] = "Item-by-Item Breakdown"
    ws_dash["B17"].font = font_section
    
    # Item Breakdown Table Headers (Row 18)
    headers_breakdown = [
        ("B18", "QID"),
        ("C18:H18", "Question Text"),
        ("I18:J18", "Type"),
        ("K18", "Raw Avg"),
        ("L18:M18", "Usability Contribution"),
        ("N18:O18", "Usability Level")
    ]
    for rng, text in headers_breakdown:
        if ":" in rng:
            ws_dash.merge_cells(rng)
            start_cell = rng.split(":")[0]
            ws_dash[start_cell] = text
        else:
            ws_dash[rng] = text
            start_cell = rng
        style_range(ws_dash, rng, font=font_header, fill=fill_secondary, border=border_all, alignment=align_center)
        
    # Question Texts & Formulas for Item breakdown
    questions_info = [
        ("Q1", "I think that I would like to use this system frequently.", "Positive"),
        ("Q2", "I found the system unnecessarily complex.", "Negative"),
        ("Q3", "I thought the system was easy to use.", "Positive"),
        ("Q4", "I think that I would need the support of a technical person to use this.", "Negative"),
        ("Q5", "I found the various functions in this system were well integrated.", "Positive"),
        ("Q6", "I thought there was too much inconsistency in this system.", "Negative"),
        ("Q7", "I would imagine that most people would learn to use this quickly.", "Positive"),
        ("Q8", "I found the system very cumbersome to use.", "Negative"),
        ("Q9", "I felt very confident using the system.", "Positive"),
        ("Q10", "I needed to learn a lot of things before I could get going with this.", "Negative")
    ]
    
    col_mapping = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K"] # maps to SUS Data B to K
    
    for idx, (qid, text, qtype) in enumerate(questions_info):
        r = 19 + idx
        # Merges
        ws_dash.merge_cells(f"C{r}:H{r}")
        ws_dash.merge_cells(f"I{r}:J{r}")
        ws_dash.merge_cells(f"L{r}:M{r}")
        ws_dash.merge_cells(f"N{r}:O{r}")
        
        # Set values & formulas
        ws_dash[f"B{r}"] = qid
        ws_dash[f"C{r}"] = text
        ws_dash[f"I{r}"] = qtype
        
        data_col = col_mapping[idx]
        ws_dash[f"K{r}"] = f"='SUS Data'!{data_col}36"
        
        if qtype == "Positive":
            ws_dash[f"L{r}"] = f"=K{r}-1"
        else:
            ws_dash[f"L{r}"] = f"=5-K{r}"
            
        ws_dash[f"N{r}"] = f"=IF(L{r}>=3,\"Strong\",IF(L{r}>=2,\"Moderate\",\"Weak\"))"
        
        # Styles
        row_fill = fill_zebra if idx % 2 == 1 else fill_white
        style_range(ws_dash, f"B{r}:O{r}", font=font_body, fill=row_fill, border=border_all, alignment=align_center)
        ws_dash[f"C{r}"].alignment = align_left # Left align text
        ws_dash[f"K{r}"].number_format = "0.00"
        ws_dash[f"L{r}"].number_format = "0.00"
        
    # Set Row Heights for spacing
    ws_dash.row_dimensions[4].height = 22
    ws_dash.row_dimensions[5].height = 18
    ws_dash.row_dimensions[6].height = 32
    ws_dash.row_dimensions[8].height = 22
    ws_dash.row_dimensions[17].height = 22
    ws_dash.row_dimensions[18].height = 22
    for r in range(19, 29):
        ws_dash.row_dimensions[r].height = 20

    # Add Chart to Dashboard: Question Usability Contribution
    chart = BarChart()
    chart.type = "col"
    chart.style = 10
    chart.title = "Usability Contribution Score by Question (Higher is Better)"
    chart.y_axis.title = "Score (0 - 4)"
    chart.x_axis.title = "Question"
    
    # We reference L19:L28 for Y values (Usability Contribution)
    data_ref = Reference(ws_dash, min_col=12, min_row=18, max_row=28) # L18:L28, includes title
    cats_ref = Reference(ws_dash, min_col=2, min_row=19, max_row=28)  # B19:B28, QID categories
    
    chart.add_data(data_ref, titles_from_data=True)
    chart.set_categories(cats_ref)
    chart.legend = None
    chart.width = 17
    chart.height = 11
    
    ws_dash.add_chart(chart, "I30")

    # Add Chart to Dashboard: Individual SUS Score
    chart2 = BarChart()
    chart2.type = "col"
    chart2.style = 11
    chart2.title = "Individual Respondent SUS Scores"
    chart2.y_axis.title = "SUS Score (0 - 100)"
    chart2.x_axis.title = "Respondent"
    
    # Reference SUS Data Sheet L15:L35
    data_ref2 = Reference(ws_data, min_col=12, min_row=15, max_row=35) # L15:L35 (Includes Header)
    cats_ref2 = Reference(ws_data, min_col=1, min_row=16, max_row=35)  # A16:A35 (Respondent ID)
    
    chart2.add_data(data_ref2, titles_from_data=True)
    chart2.set_categories(cats_ref2)
    chart2.legend = None
    chart2.width = 22
    chart2.height = 11
    
    ws_dash.add_chart(chart2, "B30")

    # ----------------------------------------------------
    # SHEET 2: DATA & CALCULATIONS
    # ----------------------------------------------------
    # Column Widths
    col_widths_data = {
        'A': 16, # Respondent ID
        'B': 8, 'C': 8, 'D': 8, 'E': 8, 'F': 8, 'G': 8, 'H': 8, 'I': 8, 'J': 8, 'K': 8, # Q1-Q10
        'L': 14, # SUS Score
        'M': 10, # Grade
        'N': 20  # Adjective Rating
    }
    for col, width in col_widths_data.items():
        ws_data.column_dimensions[col].width = width
        
    # Title Block
    ws_data.merge_cells("A2:N3")
    ws_data["A2"] = "SUS SURVEY RAW RESPONSES & CALCULATIONS"
    ws_data["A2"].font = font_title
    ws_data["A2"].fill = fill_primary
    ws_data["A2"].alignment = align_center
    ws_data.row_dimensions[2].height = 22
    ws_data.row_dimensions[3].height = 18
    
    # Instruction Banner
    ws_data.merge_cells("A5:N6")
    instructions = (
        "INSTRUCTIONS:\n"
        "1. Enter responses for Q1 to Q10 in cells B16 to K35. Use a Likert scale of 1 (Strongly Disagree) to 5 (Strongly Agree).\n"
        "2. The workbook automatically calculates the SUS Score, Grade, and Adjective Rating for each respondent using standard formula."
    )
    ws_data["A5"] = instructions
    ws_data["A5"].alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
    ws_data["A5"].font = font_italic
    ws_data["A5"].fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    style_range(ws_data, "A5:N6", border=border_all)
    ws_data.row_dimensions[5].height = 20
    ws_data.row_dimensions[6].height = 20
    
    # Questionnaire Reference in Data Sheet
    ws_data["A8"] = "SUS Questionnaire Guide:"
    ws_data["A8"].font = font_body_bold
    
    # Format Questionnaire List
    ws_data.merge_cells("A9:G9")
    ws_data["A9"] = "Positive Items (Score = Response - 1)"
    ws_data["A9"].font = font_body_bold
    ws_data["A9"].fill = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")
    ws_data.merge_cells("H9:N9")
    ws_data["H9"] = "Negative Items (Score = 5 - Response)"
    ws_data["H9"].font = font_body_bold
    ws_data["H9"].fill = PatternFill(start_color="FEF2F2", end_color="FEF2F2", fill_type="solid")
    
    pos_qs = [
        "Q1: I think that I would like to use this system frequently.",
        "Q3: I thought the system was easy to use.",
        "Q5: I found the various functions in this system were well integrated.",
        "Q7: I would imagine that most people would learn to use this quickly.",
        "Q9: I felt very confident using the system."
    ]
    neg_qs = [
        "Q2: I found the system unnecessarily complex.",
        "Q4: I think that I would need technical support to use this system.",
        "Q6: I thought there was too much inconsistency in this system.",
        "Q8: I found the system very cumbersome to use.",
        "Q10: I needed to learn a lot of things before I could get going."
    ]
    
    for idx in range(5):
        r = 10 + idx
        ws_data.merge_cells(f"A{r}:G{r}")
        ws_data[f"A{r}"] = pos_qs[idx]
        ws_data[f"A{r}"].font = font_italic
        ws_data[f"A{r}"].alignment = align_left
        
        ws_data.merge_cells(f"H{r}:N{r}")
        ws_data[f"H{r}"] = neg_qs[idx]
        ws_data[f"H{r}"].font = font_italic
        ws_data[f"H{r}"].alignment = align_left
        ws_data.row_dimensions[r].height = 18

    # Table Header (Row 15)
    headers_data = ["Respondent ID", "Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10", "SUS Score", "Grade", "Adjective Rating"]
    for idx, text in enumerate(headers_data):
        col_letter = get_column_letter(idx + 1)
        ws_data[f"{col_letter}15"] = text
        ws_data[f"{col_letter}15"].font = font_header
        ws_data[f"{col_letter}15"].fill = fill_primary
        ws_data[f"{col_letter}15"].alignment = align_center
        ws_data[f"{col_letter}15"].border = border_all
    ws_data.row_dimensions[15].height = 24
    
    # 20 demo responses (only written with --sample; real survey answers go in these rows)
    sample_responses = [
        [4, 2, 4, 2, 4, 2, 4, 2, 4, 2], # R1: 75.0
        [5, 1, 4, 1, 5, 2, 5, 1, 4, 1], # R2: 92.5
        [3, 3, 4, 2, 3, 3, 3, 3, 3, 3], # R3: 60.0
        [4, 3, 4, 2, 4, 3, 4, 2, 4, 2], # R4: 70.0
        [3, 4, 3, 3, 3, 3, 3, 3, 3, 4], # R5: 45.0
        [5, 2, 5, 1, 4, 2, 4, 2, 5, 1], # R6: 87.5
        [4, 1, 4, 2, 4, 1, 4, 2, 4, 2], # R7: 80.0
        [3, 3, 3, 3, 4, 3, 4, 3, 3, 3], # R8: 55.0
        [4, 2, 4, 2, 5, 2, 5, 2, 4, 2], # R9: 80.0
        [5, 1, 5, 1, 5, 1, 5, 1, 5, 1], # R10: 100.0
        [4, 3, 4, 2, 4, 2, 4, 3, 4, 2], # R11: 72.5
        [3, 2, 4, 2, 3, 3, 4, 2, 3, 2], # R12: 70.0
        [4, 2, 4, 1, 4, 2, 4, 2, 4, 2], # R13: 77.5
        [3, 4, 3, 4, 3, 4, 2, 4, 3, 4], # R14: 35.0
        [5, 1, 4, 2, 5, 1, 4, 2, 5, 2], # R15: 85.0
        [4, 3, 3, 3, 4, 3, 4, 2, 4, 3], # R16: 62.5
        [4, 2, 4, 2, 4, 2, 5, 2, 4, 2], # R17: 77.5
        [3, 3, 4, 3, 3, 3, 4, 3, 4, 3], # R18: 60.0
        [5, 2, 4, 2, 4, 2, 5, 2, 5, 2], # R19: 82.5
        [4, 2, 4, 2, 4, 2, 4, 2, 4, 3]  # R20: 72.5
    ]
    
    for idx, resp in enumerate(sample_responses):
        r = 16 + idx
        if not with_sample:
            resp = [None] * 10
        ws_data.row_dimensions[r].height = 20
        # Respondent ID
        ws_data[f"A{r}"] = f"SAMPLE {idx+1:02d}" if with_sample else f"Respondent {idx+1:02d}"
        ws_data[f"A{r}"].alignment = align_left
        ws_data[f"A{r}"].font = font_body
        ws_data[f"A{r}"].border = border_all
        
        # Populate responses
        for q_idx, val in enumerate(resp):
            col_letter = get_column_letter(q_idx + 2)
            ws_data[f"{col_letter}{r}"] = val
            ws_data[f"{col_letter}{r}"].alignment = align_center
            ws_data[f"{col_letter}{r}"].font = font_body
            ws_data[f"{col_letter}{r}"].border = border_all
            
        # Write SUS Score Formula
        # =((B16+D16+F16+H16+J16-5)+(25-(C16+E16+G16+I16+K16)))*2.5
        ws_data[f"L{r}"] = f"=IF(COUNT(B{r}:K{r})<10,\"\",((B{r}+D{r}+F{r}+H{r}+J{r}-5)+(25-(C{r}+E{r}+G{r}+I{r}+K{r})))*2.5)"
        ws_data[f"L{r}"].alignment = align_center
        ws_data[f"L{r}"].font = font_body_bold
        ws_data[f"L{r}"].border = border_all
        ws_data[f"L{r}"].number_format = "0.0"
        
        # Write Grade Formula
        ws_data[f"M{r}"] = f"=IF(L{r}=\"\",\"\",IF(L{r}>=80.3,\"A\",IF(L{r}>=68,\"B\",IF(L{r}>=51,\"C\",IF(L{r}>=38,\"D\",\"F\")))))"
        ws_data[f"M{r}"].alignment = align_center
        ws_data[f"M{r}"].font = font_body
        ws_data[f"M{r}"].border = border_all
        
        # Write Adjective Rating Formula
        ws_data[f"N{r}"] = f"=IF(L{r}=\"\",\"\",IF(L{r}>=85,\"Best Imaginable\",IF(L{r}>=73,\"Excellent\",IF(L{r}>=52,\"Good\",IF(L{r}>=38,\"OK\",IF(L{r}>=25,\"Poor\",\"Worst Imaginable\"))))))"
        ws_data[f"N{r}"].alignment = align_center
        ws_data[f"N{r}"].font = font_body
        ws_data[f"N{r}"].border = border_all
        
        # Zebra Striping
        if idx % 2 == 1:
            for c_idx in range(1, 15):
                ws_data.cell(row=r, column=c_idx).fill = fill_zebra

    # Average Row (Row 36)
    ws_data.row_dimensions[36].height = 22
    ws_data["A36"] = "Average"
    ws_data["A36"].font = font_body_bold
    ws_data["A36"].alignment = align_left
    ws_data["A36"].border = border_double_bottom
    ws_data["A36"].fill = fill_card_lbl
    
    # Calculate Average for Q1 to Q10
    for q_idx in range(10):
        col_letter = get_column_letter(q_idx + 2)
        ws_data[f"{col_letter}36"] = f"=IFERROR(AVERAGE({col_letter}16:{col_letter}35),\"\")"
        ws_data[f"{col_letter}36"].alignment = align_center
        ws_data[f"{col_letter}36"].font = font_body_bold
        ws_data[f"{col_letter}36"].border = border_double_bottom
        ws_data[f"{col_letter}36"].number_format = "0.00"
        ws_data[f"{col_letter}36"].fill = fill_card_lbl

    # Calculate Average SUS Score
    ws_data["L36"] = "=IFERROR(AVERAGE(L16:L35),\"\")"
    ws_data["L36"].alignment = align_center
    ws_data["L36"].font = font_body_bold
    ws_data["L36"].border = border_double_bottom
    ws_data["L36"].number_format = "0.0"
    ws_data["L36"].fill = fill_card_lbl
    
    # Average Grade
    ws_data["M36"] = "=IF(L36=\"\",\"\",IF(L36>=80.3,\"A\",IF(L36>=68,\"B\",IF(L36>=51,\"C\",IF(L36>=38,\"D\",\"F\")))))"
    ws_data["M36"].alignment = align_center
    ws_data["M36"].font = font_body_bold
    ws_data["M36"].border = border_double_bottom
    ws_data["M36"].fill = fill_card_lbl
    
    # Average Adjective Rating
    ws_data["N36"] = "=IF(L36=\"\",\"\",IF(L36>=85,\"Best Imaginable\",IF(L36>=73,\"Excellent\",IF(L36>=52,\"Good\",IF(L36>=38,\"OK\",IF(L36>=25,\"Poor\",\"Worst Imaginable\"))))))"
    ws_data["N36"].alignment = align_center
    ws_data["N36"].font = font_body_bold
    ws_data["N36"].border = border_double_bottom
    ws_data["N36"].fill = fill_card_lbl

    # Save to path
    output_path = Path(__file__).resolve().parent / "SUS_Test.xlsx"
    wb.save(output_path)
    print(f"SUS Test template created successfully at: {output_path}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", action="store_true", help="fill the sheet with clearly-labelled demo responses")
    create_sus_template(with_sample=ap.parse_args().sample)
