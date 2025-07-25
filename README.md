# GAS_account_book
GASで作成する家計簿アプリ

# **バケット型家計簿 on Google Apps Script**

**Googleスプレッドシートをデータベースとして活用する、高機能な個人向け家計簿ウェブアプリケーションです。**  
このプロジェクトは、特定の個人の家計管理フロー（収入の役割分担、目的別の貯金管理など）をアプリケーションのコアロジックに組み込むというユニークなコンセプトに基づいて開発されました。単なる収支記録ツールではなく、将来の資産形成をシミュレーションするための実践的なパーソナルファイナンス・ダッシュボードとして機能します。

## **Features (主な機能)**

* **バケット型資産管理:** 収入を目的別の「口座（バケット）」に振り分け、それぞれの残高を独立して管理。  
* **最適化された資金フロー:** 「妻の給料→生活費」「夫の給料→貯金」といった、実際の家計運用ルールをアプリのロジックに反映。  
* **給料日のかんたん登録:** ウィザード形式で毎月の給料を簡単に入力し、設定に基づいて自動で振り分け。  
* **柔軟な口座設定:** 各口座に「消費支出」「貯金・積立」の種別や、階層表示のための「グループ」を自由に設定可能。  
* **テンプレート機能:** 毎月の収入や振分パターンをテンプレートとして保存・呼出可能。  
* **多角的な将来シミュレーション:** テンプレートと将来の大きな出費計画（例：車の購入）に基づき、指定した複数の貯金口座の3年後の残高推移をグラフで視覚的に予測。  
* **完全なCRUD操作:** 取引履歴、口座設定、将来の出費など、すべてのデータをアプリ上から作成・読み取り・更新・削除可能。  
* **レスポンシブデザイン & ダークモード:** PC、スマートフォン両対応。OSの設定に連動するダークモードも搭載。

## **Tech Stack (使用技術)**

* **バックエンド:** Google Apps Script (JavaScript)  
* **フロントエンド:** HTML, Tailwind CSS, Vanilla JavaScript  
* **データベース:** Google Sheets  
* **グラフ描画:** Chart.js  
* **アイコン:** Font Awesome

## **Getting Started (導入手順)**

### **Prerequisites (前提条件)**

* Googleアカウント

### **Installation (インストール)**

1. **Googleスプレッドシートの準備:**  
   * 新しいGoogleスプレッドシートを作成します。  
   * 以下の4つのシートを、指定された名前で作成します。  
     * Accounts  
     * Transactions  
     * AllocationTemplates  
     * FutureExpenses  
   * 各シートの1行目に、後述の「Spreadsheet Setup」セクションで定義されているヘッダーを正確に入力します。  
   * スプレッドシートのURLから**スプレッドシートID**をコピーしておきます。  
2. **Apps Scriptプロジェクトの作成:**  
   * 作成したスプレッドシートで、「拡張機能」 \> 「Apps Script」を開きます。  
   * Code.gsとIndex.htmlの2つのファイルを用意します。  
   * 提供されたソースコードを、それぞれのファイルにコピー＆ペーストします。  
   * Code.gsのSS\_ID定数を、先ほどコピーしたご自身のスプレッドシートIDに書き換えます。  
3. **デプロイ:**  
   * スクリプトエディタの「デプロイ」 \> 「新しいデプロイ」を選択します。  
   * 「種類の選択」で「ウェブアプリ」を選択し、アクセス設定を「自分のみ」にしてデプロイします。  
   * 初回実行時にGoogleアカウントでの承認プロセスを完了させます。  
   * 表示されたウェブアプリのURLにアクセスすると、アプリが起動します。

## **Usage (使い方)**

1. **口座設定:** 「口座設定」タブで、家計で管理したい全ての項目を口座として定義します。  
2. **給料登録:** ヘッダーの「給料を登録」ボタンから、毎月の収入を記録します。  
3. **予算振分:** 「予算の振分」タブで、テンプレートを読み込むか手動で、収入を各口座に振り分けます。  
4. **取引記録:** 日々の支出を「取引記録」タブから登録します。  
5. **状況確認 & 計画:** 「ダッシュボード」で現状を把握し、「シミュレーション」で将来の計画を立てます。

## **Spreadsheet Setup (シートの定義)**

#### **Accounts シート**

口座のマスタデータ。残高はスクリプトによって自動計算されます。

| 列 | ヘッダー名 | 内容 |
| :---- | :---- | :---- |
| A | **Category** | 口座名（例: 家賃, 生活防衛費, 車貯金）。**主キーとして機能します。** |
| B | **Balance** | 現在の残高。**自動計算されるため編集不要。** |
| C | **Type** | 消費支出 または 貯金・積立。ダッシュボードの表示対象を制御。 |
| D | **Group** | 口座が属するグループ名（例: 2人の貯金）。UI上での階層化に使用。 |
| E | **Goal** | 目標金額（数値）。任意設定。 |
| F | **IsDefault** | TRUEの場合、夫の給料のデフォルト入金先となる。 |
| G | **ID** | 口座の一意のID。**スクリプトが自動で割り振ります。** |

#### **Transactions シート**

全ての取引（収入、支出、振分）の時系列データ。

| 列 | ヘッダー名 | 内容 |
| :---- | :---- | :---- |
| A | **ID** | 取引ごとの一意のID。**自動生成。** |
| B | **Date** | 取引日。 |
| C | **Type** | 収入, 支出, 振分 のいずれか。 |
| D | **Amount** | 金額。 |
| E | **Category** | 関連する口座名、または収入源。 |
| F | **Memo** | メモ（任意）。 |

#### **AllocationTemplates シート**

予算振分パターンの定義。

| 列 | ヘッダー名 | 内容 |
| :---- | :---- | :---- |
| A | **TemplateName** | テンプレート名。 |
| B | **Type** | 収入 または 振分。 |
| C | **Category** | 収入源または振分先の口座名。 |
| D | **Amount** | 金額。 |
| E | **IsExpense** | TRUEの場合、振分と同時に支出としても記録される。 |

#### **FutureExpenses シート**

シミュレーションに影響を与える将来の単発出費。

| 列 | ヘッダー名 | 内容 |
| :---- | :---- | :---- |
| A | **ID** | 一意のID。**自動生成。** |
| B | **Name** | 出費名。 |
| C | **Amount** | 予定金額。 |
| D | **Date** | 予定日。 |
| E | **SourceAccount** | この出費を引き落とす予定の口座名。 |

## **Contributing (コントリビューション)**

このプロジェクトは個人用に開発されましたが、改善のためのIssueやPull Requestは歓迎します。

## **License (ライセンス)**

This project is licensed under the MIT License.
