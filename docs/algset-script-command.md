# Algset Script Command Reference

Algset Script is a safe, SQL-like batch language for the SquanX algset devtool. It is parsed into tree and case edits; it is not JavaScript and must not be evaluated as code.

Scripts run only when the user presses `Run`. Statements end with `.`.

## Statement Forms

```text
if <target> <execute-command>[ and <execute-command>...].
create <create-command>.
delete <delete-command>.
arrange <cases|folders|elements|items> in <scope> by <type|alphabetical-order> [and <type|alphabetical-order>].
```

Keywords are case-insensitive. Names and values are case-sensitive.

Canonical paths are JSON arrays so Square-1 names containing `/` are safe:

```text
["3-3", "J/J", "Jr/Jr"]
```

## Scopes

`root`: active root.

`here`: root or folder that opened the script modal.

`selected`: currently selected tree item.

Explicit scope:

```text
in ["3-3", "J/J"]
```

Folder scopes target descendant cases by default.

## Targets

Targets choose cases. Multiple filters can be joined with `where`, `and`, or `&` before the first execute command.

### Name Targets

```text
if case-name is "Jr/Jr" in here append parity=[on].
if case-name contains "Jf/" in ["1-1", "J/J"] append top-layer=W11W55Y33W77.
if case-name starts-with "Jf/" in here append top-layer=W11W55Y33W77.
if case-name ends-with "/Jf" in here append bottom-layer=99YddWbbYffY.
if case-name matches "^Jf/" in here append top-layer=W11W55Y33W77.
```

`folder-name` supports the same operators and targets descendant cases inside matching folders.

### Split Targets

```text
if case-name split "/" left is "Jf" in here append top-layer=W11W55Y33W77.
if case-name split "/" right is "Jf" in here append bottom-layer=99YddWbbYffY.
```

### Path Targets

```text
if path is ["3-3", "J/J", "Jr/Jr"] append alg="(1,0) /".
if path contains ["3-3", "J/J"] append parity=[on].
if path starts-with ["3-3", "J/J"] append parity=[on].
if path ends-with ["J/J", "Jr/Jr"] append parity=[on].
if path matches "^3-3/.+/Jr/Jr$" append parity=[on].
```

### Field Targets

```text
if top-layer is W11W55Y33W77 in here add parity=[on].
if bottom-layer contains 99Y in here add parity=[on].
if alg contains "/" in here add parity=[on].
if parity has on in here remove parity=[on].
if constraints has A in here remove constraints A.
if constraints A has 3 in here remove constraints A=[3].
```

## Execute Commands

Execute commands mutate matched cases.

### Field Aliases

`top-layer`, `topLayer`, `toplayer`: `inputTop`

`bottom-layer`, `bottomLayer`, `bottomlayer`: `inputBottom`

`pre-abf`, `preABF`, `preabf`: sets both `rul` and `rdl`

`post-abf`, `postABF`, `postabf`: sets `auf` from `U` values and `adf` from `D` values

`pre-auf`, `preAUF`: `rul`

`pre-adf`, `preADF`: `rdl`

`post-auf`, `postAUF`: `auf`

`post-adf`, `postADF`: `adf`

Other fields: `alg`, `parity`, `constraints`, `rul`, `rdl`, `auf`, `adf`

### Set Or Replace A Field

`append` and `set` replace scalar fields and replace array fields with the provided array.

```text
if case-name contains "Jf/" in here append top-layer=W11W55Y33W77.
if case-name contains "/Jf" in here set bottom-layer=99YddWbbYffY.
if case-name is "Jr/Jr" in here append alg="(1,0) / (3,0) /".
```

### Add To Array Fields

```text
if case-name contains "J/" in here add parity=[on].
if case-name contains "N/" in here add pre-abf=[-5,0,6].
if case-name contains "/N" in here add post-abf=[U0,U,U2,U'].
```

### Remove From Array Or Object Fields

```text
if parity has on in here remove parity=[on].
if constraints has A in here remove constraints A.
if constraints A has 3 in here remove constraints A=[3].
```

### Constraints

Set all constraints:

```text
if case-name is "Jr/Jr" in here append constraints={"A":[1,3], "BC":[5,7]}.
```

Set one constraint:

```text
if case-name is "Jr/Jr" in here append constraints A=[1,3,5].
```

### Replace Layer Pattern

`*` is a wildcard. Non-wildcard positions in the match mask are replaced by the corresponding positions in the replacement mask.

```text
if path starts-with ["3-3"] replace top-layer=W**W**Y**W** with W**Y**Y**Y**.
```

### Rename

```text
if case-name contains "old" in here rename case-name replace "old" with "new".
if folder-name contains "old" in root rename folder-name replace "old" with "new".
```

### Copy

```text
if case-name contains "J/" in here copy from template.
if case-name contains "J/" in here copy top-layer to bottom-layer.
```

### Command Chaining

```text
if case-name contains "Jf/" in here append top-layer=W11W55Y33W77 and add pre-abf=[1,2,-5].
```

## Create Commands

Create a case:

```text
create case "Jr/Jr" in ["3-3", "J/J"] from template.
create case "Jr/Jr" in here with top-layer=W11W55Y33W77 bottom-layer=99YddWbbYffY parity=[on].
```

Create a folder:

```text
create folder ["3-3", "J/J"] in root.
```

Create paired case trees:

```text
create tree ["J=Jf,Jr,Jb,Jl", "N=N", "S=S"] from template in ["1-1"].
```

The tree command creates pair folders such as `Jf/Jr` and case entries inside them according to the expanded left/right groups.

## Delete Commands

```text
delete case "Jr/Jr" in ["3-3", "J/J"].
delete folder ["3-3", "J/J"].
delete if case-name contains "temp" in here.
```

Deletes should report counts. Large deletes should be confirmed by the UI before applying.

## Arrange Commands

Arrange commands reorder the immediate children of the target folder or root.

`items` and `elements` mean both folders and cases. `type` groups folders above cases while preserving the existing order inside each group. `alphabetical-order` sorts by item name. Add `ascending` or `descending` after `alphabetical-order` to choose direction.

If `type` and `alphabetical-order` are both present, folders stay above cases and each group is sorted alphabetically.

```text
arrange elements in here by type and alphabetical-order ascending.
arrange items in ["EOCP"] by alphabetical-order descending & type.
arrange cases in selected by alphabetical-order ascending.
arrange folders in root by type.
```

## Value Syntax

Strings may be quoted. Quote names and algorithms when they contain spaces or command punctuation.

Lists:

```text
[on,tpbp]
[-5,0,6]
[U0,U,U2,U']
```

Objects, currently for constraints:

```text
{"A":[1,3], "BC":[5,7]}
```

Layer strings are 12-character Square-1 layer encodings. In the app, press `Tab` after `top-layer=` or `bottom-layer=` to open the visual layer picker.

In the app's script terminal, type a command after `>` and press `Enter` to run it. End a line with `\` before pressing `Enter` to continue writing on a new line. Type `help` to open this reference.

For `parity`, `pre-abf`, `post-abf`, `rul`, `rdl`, `auf`, and `adf`, press `Tab` after `field=` to open checkbox pickers. The `pre-abf` picker shows Pre AUF and Pre ADF sections and inserts them as separate `pre-auf=[...]` and `pre-adf=[...]` commands, `post-abf` shows Post AUF and Post ADF sections, and `parity=ignore` clears parity without saving `ignore` as a parity value.

## Typical Recipes

Assign top layer when the left side of the case name is `Jf`:

```text
if case-name split "/" left is "Jf" in ["3-3"] append top-layer=W11W55Y33W77.
```

Assign bottom layer when the right side is `Jf`:

```text
if case-name split "/" right is "Jf" in ["3-3"] append bottom-layer=99YddWbbYffY.
```

Convert a copied `1-1` folder into a `3-3` folder by changing specific layer slots:

```text
if path starts-with ["3-3"] replace top-layer=W**W**Y**W** with W**Y**Y**Y** and replace bottom-layer=9**9**Y**9** with 9**Y**Y**Y**.
```

Create a small paired tree from the template:

```text
create tree ["J=Jf,Jr,Jb,Jl", "N=N", "S=S"] from template in ["EOCP"].
```
