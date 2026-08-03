package mspdi

import (
	"encoding/xml"
	"fmt"
	"io"
	"time"

	"github.com/AndyKorea83/SimplePM/src/Backend/internal/entity"
)

// mspdiNamespace — XML-неймспейс, который MSPDI-файлы объявляют на корневом
// элементе <Project> (см. samples/project.xml) — Write воспроизводит его,
// чтобы экспортированный файл выглядел как настоящий MSPDI-документ, хотя
// Parse он не нужен (encoding/xml в Go сопоставляет элементы по локальному имени).
const mspdiNamespace = "http://schemas.microsoft.com/project"

// Write сериализует p как MSPDI XML-документ, покрывая только те поля, что
// реально моделирует приложение (Name/Title/даты/Tasks/Resources/
// Assignments) — не полный клон схемы MS Project (Calendars, SaveVersion
// и т.п. не хранятся в entity.Project, писать их там нечего). Результат
// проходит round-trip через Parse.
func Write(w io.Writer, p *entity.Project) error {
	doc := fromProject(p)

	if _, err := io.WriteString(w, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+"\n"); err != nil {
		return fmt.Errorf("mspdi: write header: %w", err)
	}
	enc := xml.NewEncoder(w)
	enc.Indent("", "    ")
	if err := enc.Encode(doc); err != nil {
		return fmt.Errorf("mspdi: encode xml: %w", err)
	}
	return nil
}

func fromProject(p *entity.Project) xmlProject {
	tasks := orderedByHierarchy(p.Tasks)
	taskList := make([]xmlTask, 0, len(tasks))
	for _, t := range tasks {
		taskList = append(taskList, fromTask(t))
	}

	resources := make([]xmlResource, 0, len(p.Resources))
	for _, r := range p.Resources {
		resources = append(resources, xmlResource{
			UID:          r.UID,
			Name:         r.Name,
			Initials:     r.Initials,
			Group:        r.Group,
			EmailAddress: r.Email,
		})
	}

	assignments := make([]xmlAssignment, 0, len(p.Assignments))
	for _, a := range p.Assignments {
		assignments = append(assignments, xmlAssignment{
			UID:         a.UID,
			TaskUID:     a.TaskUID,
			ResourceUID: a.ResourceUID,
			Units:       a.Units,
			Work:        formatISODuration(a.Work),
		})
	}

	return xmlProject{
		XMLNS:       mspdiNamespace,
		Name:        p.Name,
		Title:       p.Title,
		StartDate:   formatMspdiTime(p.StartDate),
		FinishDate:  formatMspdiTime(p.FinishDate),
		Tasks:       xmlTasks{Task: taskList},
		Resources:   xmlResources{Resource: resources},
		Assignments: xmlAssignments{Assignment: assignments},
	}
}

func fromTask(t entity.Task) xmlTask {
	links := make([]xmlPredecessorLink, 0, len(t.Dependencies))
	for _, d := range t.Dependencies {
		links = append(links, xmlPredecessorLink{
			PredecessorUID: d.PredecessorUID,
			Type:           int(d.Type),
		})
	}

	return xmlTask{
		UID:             t.UID,
		ID:              t.ID,
		Name:            t.Name,
		WBS:             t.WBS,
		OutlineLevel:    t.OutlineLevel,
		Start:           formatMspdiTime(t.Start),
		Finish:          formatMspdiTime(t.Finish),
		Duration:        formatISODuration(t.Duration),
		PercentComplete: t.PercentComplete,
		Milestone:       intBool(t.IsMilestone),
		Summary:         intBool(t.IsSummary),
		PredecessorLink: links,
	}
}

func formatMspdiTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format(mspdiTimeLayout)
}

// formatISODuration — обратная функция к parseISODuration: например, 88h -> "PT88H0M0S".
func formatISODuration(d time.Duration) string {
	total := int64(d.Round(time.Second) / time.Second)
	hours := total / 3600
	minutes := (total % 3600) / 60
	seconds := total % 60
	return fmt.Sprintf("PT%dH%dM%dS", hours, minutes, seconds)
}

// orderedByHierarchy пересобирает задачи в depth-first обход (каждый
// родитель сразу сопровождается своими детьми) по ParentUID, сохраняя
// исходный относительный порядок сиблингов. Задачи хранятся append-only при
// мутации (CreateTask всегда добавляет в конец среза, где бы ни сидел её
// родитель), поэтому хранимый порядок обычно не отражает форму дерева — а
// assignParentUIDs в Parse восстанавливает иерархию исключительно из
// порядка документа + OutlineLevel, так что Write обязан восстановить этот
// порядок, иначе последующий импорт пересобрал бы неверное дерево.
func orderedByHierarchy(tasks []entity.Task) []entity.Task {
	byUID := make(map[int]entity.Task, len(tasks))
	childrenByParent := make(map[int][]int, len(tasks))
	roots := make([]int, 0, len(tasks))
	for _, t := range tasks {
		byUID[t.UID] = t
		if t.ParentUID != nil {
			childrenByParent[*t.ParentUID] = append(childrenByParent[*t.ParentUID], t.UID)
		} else {
			roots = append(roots, t.UID)
		}
	}

	ordered := make([]entity.Task, 0, len(tasks))
	var visit func(uid int)
	visit = func(uid int) {
		ordered = append(ordered, byUID[uid])
		for _, childUID := range childrenByParent[uid] {
			visit(childUID)
		}
	}
	for _, uid := range roots {
		visit(uid)
	}
	return ordered
}
