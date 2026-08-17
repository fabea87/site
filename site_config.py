# -*- coding: utf-8 -*-
"""个人主页内容配置：所有文字/链接/数据集中在这里维护。

修改后运行 `python build.py` 重新生成 index.html 即可。
"""

SITE = {
    # ---------- 身份 ----------
    "name": ['Da "Alex" Yan', ", Ph. D."],
    "short_name": "Da Yan",
    "tagline": "CALL &amp; Feedback Researcher",
    "title": "CALL &amp; Feedback Researcher",
    # ---------- 联系方式 ----------
    "email": "alexyan1987@outlook.com",
    "scholar": "28WTkNkAAAAJ",
    "orcid": "0000-0002-1265-9772",
    "github": "fabea",
    "cv_en": "https://870603.xyz/assets/pdf/CV.pdf",
    "cv_cn": "https://870603.xyz/assets/pdf/CV-cn.pdf",
    # ---------- 站点元信息 ----------
    "url": "https://870603.xyz",
    "description": (
        'Personal academic homepage of Da "Alex" Yan, Ph.D. — researcher in '
        "Computer-Assisted Language Learning (CALL), feedback, and formative "
        "assessment at Wenzhou Medical University."
    ),
    "affiliation": ("Wenzhou Medical University", "https://www.wmu.edu.cn"),
    # ---------- Hero 简介（HTML 片段） ----------
    "bio_text": """
                <p>
                Da "Alex" Yan(<ruby>闫<rt>yán</rt></ruby> <ruby>达<rt>dá</rt></ruby>), PhD, works on CALL and feedback.</p>
                <p>He teaches at <a href="https://www.wmu.edu.cn" target="_blank">Wenzhou Medical University</a>. His research interests include language learning; formative assessment; and human-computer interaction.
                </p>
                """,
    "bio": """
                    <p>
                    <span class="about-label">Bio:</span>
                    I hold a Ph.D. degree in Translation (2022–2025) from <a href="https://www.usm.my/" target="_blank">University of Science, Malaysia (USM)</a>.
                    With over a decade of teaching experience at
                    <a href="https://www.wmu.edu.cn" target="_blank">Wenzhou Medical University</a> and
                    <a href="https://www.xyafu.edu.cn/" target="_blank">Xinyang Agriculture and Forestry University (XYAFU)</a>,
                    I have taught core courses such as Introduction to Translation, Basic and Advanced Interpreting, and Computer-Assisted Translation, and many other English as a second language courses.
                    I have served as the principal investigator or main contributor for 12 social science research projects, focusing on translation and educational practices.
                    I have published 19 peer-reviewed papers and received several teaching awards, including the second prize in the Central China Translation Technology Teaching Competition.
                    In addition to my academic work, I have provided interpreting services for several international events, including the International Tea Culture Festival and foreign cooperation projects with local governments and universities.
                    I also review for multiple international journals.
                    </p>
                """,
    # ---------- Research Interests 标签 ----------
    "interests": [
        "Computer-Assisted Language Learning",
        "Language Learning",
        "Formative Assessment",
        "Feedback & Feedback Seeking",
        "Human–Computer Interaction",
        "Translation & Interpreting",
        "Data Science in Education",
        "GenAI in Education",
    ],
}
