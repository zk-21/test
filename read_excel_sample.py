import pandas as pd
import os

file_path = r"C:\Users\61419\Downloads\2026011-2026012_预测结果.xlsx"
if not os.path.exists(file_path):
    print(f"文件不存在: {file_path}")
    exit(1)

# 读取Excel文件
try:
    df = pd.read_excel(file_path)
    print("成功读取Excel文件")
    print(f"形状: {df.shape}")
    print(f"列名: {list(df.columns)}")
    print("\n前5行数据:")
    print(df.head())
    print("\n数据类型:")
    print(df.dtypes)
except Exception as e:
    print(f"读取失败: {e}")
    # 尝试读取所有工作表
    try:
        all_sheets = pd.read_excel(file_path, sheet_name=None)
        print(f"工作表列表: {list(all_sheets.keys())}")
        for sheet_name, sheet_df in all_sheets.items():
            print(f"\n工作表 '{sheet_name}' 形状: {sheet_df.shape}")
            print(f"列名: {list(sheet_df.columns)}")
            print(sheet_df.head())
    except Exception as e2:
        print(f"读取所有工作表失败: {e2}")